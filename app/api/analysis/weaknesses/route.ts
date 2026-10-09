
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TopicStatistics = {
  topic: string;
  totalAnswers: number;
  correctAnswers: number;
  mistakes: number;
  successRate: number;
  assessment: "not_enough_data" | "needs_practice" | "improving" | "strong";
};

export async function GET() {
  try {
    // 1. Authenticate the current user.
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

    // 2. Verify that the user is a Student.
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || profile?.role !== "student") {
      return NextResponse.json(
        { error: "Only Students can access this analysis." },
        { status: 403 }
      );
    }

    // 3. Load the student's 50 most recent quiz attempts.
    const { data: attempts, error: attemptsError } = await supabase
      .from("quiz_attempts")
      .select("id")
      .eq("student_id", user.id)
      .order("completed_at", { ascending: false })
      .limit(50);

    if (attemptsError) {
      console.error("Unable to load attempts:", attemptsError.message);

      return NextResponse.json(
        { error: "Unable to load quiz attempts." },
        { status: 500 }
      );
    }

    const attemptIds = (attempts ?? []).map(
      (attempt) => attempt.id
    );

    // No completed quiz yet.
    if (attemptIds.length === 0) {
      return NextResponse.json(
        {
          analyzedAttempts: 0,
          analyzedAnswers: 0,
          topics: [],
        },
        {
          headers: {
            "Cache-Control": "private, no-store",
          },
        }
      );
    }

    // 4. Load the answers associated with these attempts.
    const { data: answers, error: answersError } = await supabase
      .from("quiz_attempt_answers")
      .select("question_id, is_correct")
      .in("attempt_id", attemptIds);

    if (answersError) {
      console.error("Unable to load answers:", answersError.message);

      return NextResponse.json(
        { error: "Unable to load quiz answers." },
        { status: 500 }
      );
    }

    const savedAnswers = answers ?? [];

    const questionIds = [
      ...new Set(
        savedAnswers.map((answer) => answer.question_id)
      ),
    ];

    if (questionIds.length === 0) {
      return NextResponse.json(
        {
          analyzedAttempts: attemptIds.length,
          analyzedAnswers: 0,
          topics: [],
        },
        {
          headers: {
            "Cache-Control": "private, no-store",
          },
        }
      );
    }

    // 5. Retrieve the topic of each question.
    // Correct answers are NEVER requested.
    const { data: questions, error: questionsError } = await supabase
      .from("questions")
      .select("id, topic")
      .in("id", questionIds);

    if (questionsError) {
      console.error("Unable to load topics:", questionsError.message);

      return NextResponse.json(
        { error: "Unable to load question topics." },
        { status: 500 }
      );
    }

    const topicByQuestionId = new Map<string, string>();

    for (const question of questions ?? []) {
      const topic =
        typeof question.topic === "string" &&
        question.topic.trim().length > 0
          ? question.topic.trim()
          : "Uncategorized";

      topicByQuestionId.set(question.id, topic);
    }

    // Make sure no question is missing from the analysis.
    if (topicByQuestionId.size !== questionIds.length) {
      return NextResponse.json(
        { error: "Some question data is unavailable." },
        { status: 500 }
      );
    }

    // 6. Group answers by topic.
    const statisticsByTopic = new Map<
      string,
      {
        totalAnswers: number;
        correctAnswers: number;
        mistakes: number;
      }
    >();

    for (const answer of savedAnswers) {
      const topic = topicByQuestionId.get(answer.question_id);

      if (!topic) {
        continue;
      }

      const existing = statisticsByTopic.get(topic) ?? {
        totalAnswers: 0,
        correctAnswers: 0,
        mistakes: 0,
      };

      existing.totalAnswers += 1;

      if (answer.is_correct) {
        existing.correctAnswers += 1;
      } else {
        existing.mistakes += 1;
      }

      statisticsByTopic.set(topic, existing);
    }

    // 7. Calculate success rates and identify topics to review.
    const topics: TopicStatistics[] = Array.from(
      statisticsByTopic.entries()
    ).map(([topic, statistics]) => {
      const successRate = Number(
        (
          (statistics.correctAnswers /
            statistics.totalAnswers) *
          100
        ).toFixed(2)
      );

      let assessment: TopicStatistics["assessment"];

      if (statistics.totalAnswers < 5) {
        assessment = "not_enough_data";
      } else if (successRate < 60) {
        assessment = "needs_practice";
      } else if (successRate < 80) {
        assessment = "improving";
      } else {
        assessment = "strong";
      }

      return {
        topic,
        totalAnswers: statistics.totalAnswers,
        correctAnswers: statistics.correctAnswers,
        mistakes: statistics.mistakes,
        successRate,
        assessment,
      };
    });

    // 8. Show the lowest success rates first.
    topics.sort(
      (a, b) =>
        a.successRate - b.successRate ||
        b.totalAnswers - a.totalAnswers
    );

    // 9. Return the analysis.
    return NextResponse.json(
      {
        analyzedAttempts: attemptIds.length,
        analyzedAnswers: savedAnswers.length,
        topics,
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (error) {
    console.error(
      "Weakness analysis failed:",
      error instanceof Error
        ? error.message
        : "Unknown error"
    );

    return NextResponse.json(
      { error: "Unable to analyze student performance." },
      { status: 500 }
    );
  }
}
