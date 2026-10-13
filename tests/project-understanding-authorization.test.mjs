
import test from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const assignedStudentId =
  "2f741cc3-5166-41c8-95e9-4319aa47ff13";

function assertAccessDenied(result, label) {
  if (result.error) {
    assert.equal(
      result.error.code,
      "42501",
      `${label}: unexpected database error: ${result.error.message}`
    );
  } else {
    assert.equal(
      result.data?.length ?? 0,
      0,
      `${label}: private data was exposed`
    );
  }
}

test(
  "Project Understanding Check respects Tutor and anonymous access",
  async () => {
    const requiredVariables = [
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      "TEST_TUTOR_EMAIL",
      "TEST_TUTOR_PASSWORD",
    ];

    for (const name of requiredVariables) {
      assert.ok(
        process.env[name],
        `Missing environment variable: ${name}`
      );
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const publicKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    // Use a real Tutor session with the public key.
    const tutorClient = createClient(url, publicKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // Separate client without any authenticated session.
    const anonymousClient = createClient(url, publicKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data: authData, error: authError } =
      await tutorClient.auth.signInWithPassword({
        email: process.env.TEST_TUTOR_EMAIL,
        password: process.env.TEST_TUTOR_PASSWORD,
      });

    assert.ifError(authError);
    assert.ok(authData.user, "Tutor login failed");

    try {
      // 1. Confirm the Tutor role.
      const { data: profile, error: profileError } =
        await tutorClient
          .from("profiles")
          .select("role")
          .eq("id", authData.user.id)
          .single();

      assert.ifError(profileError);
      assert.equal(profile.role, "tutor");

      // 2. Tutor must be able to read their own project.
      const { data: project, error: projectError } =
        await tutorClient
          .from("projects")
          .select("id, tutor_id")
          .eq("tutor_id", authData.user.id)
          .eq("title", "Introduction to Data Analysis")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

      assert.ifError(projectError);
      assert.ok(project, "Test project not found");

      console.log("PASS: Tutor can read their project.");

      // 3. Tutor must be able to read Student Two's analysis.
      const { data: check, error: checkError } =
        await tutorClient
          .from("understanding_checks")
          .select("id, project_id, student_id")
          .eq("project_id", project.id)
          .eq("student_id", assignedStudentId)
          .limit(1)
          .maybeSingle();

      assert.ifError(checkError);
      assert.ok(check, "Student Two analysis not found");

      console.log("PASS: Tutor can read the assigned analysis.");

      // 4. An anonymous visitor must NOT see the project.
      const anonymousProject =
        await anonymousClient
          .from("projects")
          .select("id")
          .eq("id", project.id);

      assertAccessDenied(
        anonymousProject,
        "Anonymous project access"
      );

      console.log("PASS: Anonymous project access denied.");

      // 5. An anonymous visitor must NOT see the AI analysis.
      const anonymousCheck =
        await anonymousClient
          .from("understanding_checks")
          .select("id")
          .eq("id", check.id);

      assertAccessDenied(
        anonymousCheck,
        "Anonymous understanding check access"
      );

      console.log("PASS: Anonymous analysis access denied.");
    } finally {
      await tutorClient.auth.signOut({ scope: "local" });
    }
  }
);
