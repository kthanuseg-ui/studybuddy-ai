
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { analyzeProjectUnderstanding } from "@/lib/ai/analyze-project-understanding";

export const runtime = "nodejs";

type UnderstandingRequest = {
  projectId?: unknown;
  studentUnderstanding?: unknown;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  // 1. Authenticate the user using their own session.
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: "Unauthorized." },
      { status: 401 }
    );
  }

  // 2. Only Students may request AI analyses.
  const { data: profile, error: profileError } =
    await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

  if (profileError || profile?.role !== "student") {
    return NextResponse.json(
      { error: "Only Students can submit understanding checks." },
      { status: 403 }
    );
  }

  // 3. Parse and validate the submitted explanation.
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

  if (
    typeof body !== "object" ||
    body === null ||
    Array.isArray(body)
  ) {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

  const { projectId, studentUnderstanding } =
    body as UnderstandingRequest;

  if (
    typeof projectId !== "string" ||
    !UUID_REGEX.test(projectId)
  ) {
    return NextResponse.json(
      { error: "A valid projectId is required." },
      { status: 400 }
    );
  }

  if (
    typeof studentUnderstanding !== "string" ||
    studentUnderstanding.trim().length < 50 ||
    studentUnderstanding.trim().length > 5000
  ) {
    return NextResponse.json(
      {
        error:
          "Your explanation must contain between 50 and 5000 characters.",
      },
      { status: 400 }
    );
  }

  const explanation = studentUnderstanding.trim();

  // 4. Confirm that THIS Student is assigned to THIS project.
  // This query uses the Student's session and RLS policies.
  const { data: assignment, error: assignmentError } =
    await supabase
      .from("project_assignments")
      .select("project_id")
      .eq("project_id", projectId)
      .eq("student_id", user.id)
      .maybeSingle();

  if (assignmentError) {
    console.error(
      "Unable to verify project assignment:",
      assignmentError.message
    );

    return NextResponse.json(
      { error: "Unable to verify project access." },
      { status: 503 }
    );
  }

  if (!assignment) {
    return NextResponse.json(
      { error: "Project not found or not assigned to you." },
      { status: 404 }
    );
  }

  // 5. Load trusted project information from the database.
  // Never accept expected outcomes from the Student's request.
  const { data: project, error: projectError } =
    await supabase
      .from("projects")
      .select("id, title, description, expected_outcomes")
      .eq("id", projectId)
      .maybeSingle();

  if (projectError) {
    console.error(
      "Unable to load project:",
      projectError.message
    );

    return NextResponse.json(
      { error: "Unable to load the project." },
      { status: 503 }
    );
  }

  if (!project) {
    return NextResponse.json(
      { error: "Project not found." },
      { status: 404 }
    );
  }

  // 6. Verify server-only Supabase configuration.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseSecretKey) {
    console.error(
      "Missing server-side Supabase configuration."
    );

    return NextResponse.json(
      { error: "Server configuration unavailable." },
      { status: 503 }
    );
  }

  // This privileged client MUST remain server-side.
  const adminSupabase = createAdminClient(
    supabaseUrl,
    supabaseSecretKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  );

  // 7. Consume the daily quota BEFORE calling OpenAI.
  const { data: quotaAllowed, error: quotaError } =
    await adminSupabase.rpc(
      "consume_ai_project_understanding_quota",
      {
        p_student_id: user.id,
      }
    );

  if (quotaError) {
    console.error(
      "Unable to verify understanding analysis quota:",
      quotaError.message
    );

    return NextResponse.json(
      { error: "Unable to verify the daily AI limit." },
      { status: 503 }
    );
  }

  if (quotaAllowed !== true) {
    return NextResponse.json(
      {
        error:
          "Daily understanding analysis limit reached. " +
          "You can request up to 3 analyses per UTC day.",
      },
      { status: 429 }
    );
  }

  try {
    // 8. Generate structured educational feedback with OpenAI.
    const analysis = await analyzeProjectUnderstanding({
      projectTitle: project.title,
      projectDescription: project.description,
      expectedOutcomes: project.expected_outcomes,
      studentUnderstanding: explanation,
    });

    // 9. Recheck access before saving with elevated privileges.
    const { data: currentAssignment, error: recheckError } =
      await supabase
        .from("project_assignments")
        .select("project_id")
        .eq("project_id", project.id)
        .eq("student_id", user.id)
        .maybeSingle();

    if (recheckError || !currentAssignment) {
      return NextResponse.json(
        { error: "Your project assignment is no longer valid." },
        { status: 403 }
      );
    }

    // 10. Save the Student's explanation and AI-generated analysis.
    const { data: savedCheck, error: saveError } =
      await adminSupabase
        .from("understanding_checks")
        .insert({
          project_id: project.id,
          student_id: user.id,
          student_understanding: explanation,
          ai_summary: analysis.ai_summary,
          understood_points: analysis.understood_points,
          missing_points: analysis.missing_points,
          misunderstood_points: analysis.misunderstood_points,
        })
        .select("id, created_at")
        .single();

    if (saveError || !savedCheck) {
      console.error(
        "Unable to save project understanding analysis:",
        saveError?.message
      );

      return NextResponse.json(
        { error: "Unable to save the AI analysis." },
        { status: 500 }
      );
    }

    // 11. Return the analysis to the authenticated Student.
    return NextResponse.json({
      success: true,
      checkId: savedCheck.id,
      createdAt: savedCheck.created_at,
      analysis,
    });
  } catch (error) {
    console.error(
      "Project understanding AI analysis failed:",
      error instanceof Error ? error.message : "Unknown error"
    );

    return NextResponse.json(
      {
        error:
          "Unable to analyze your explanation. Please try again later.",
      },
      { status: 500 }
    );
  }
}
