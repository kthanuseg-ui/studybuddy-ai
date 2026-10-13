
import test from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { loadProjectFixture } from "./fixtures/project-understanding.mjs";

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


      // 2. Load the test project and its analysis
      // using our shared fixture instead of hard-coded UUIDs.
      const {
        projectId,
        assignedStudentId,
        checkId,
      } = await loadProjectFixture(tutorClient);

      assert.ok(projectId, "Test project not found");
      console.log("PASS: Tutor can read their project.");

      assert.ok(assignedStudentId, "Assigned student not found");
      assert.ok(checkId, "Student analysis not found");
      console.log("PASS: Tutor can read the assigned analysis.");



      // 4. An anonymous visitor must NOT see the project.
      const anonymousProject =
        await anonymousClient
          .from("projects")
          .select("id")
          .eq("id", projectId);

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
        .eq("id", checkId);

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
