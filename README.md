# StudyBuddy AI

**An AI-powered learning platform for personalized studying, automated quiz generation, and student performance tracking.**

StudyBuddy AI is a full-stack web application developed as part of an engineering internship project at **AiLaB, Tokyo, Japan**.

The platform helps students organize learning materials, generate quizzes with artificial intelligence, identify areas for improvement, and receive personalized study recommendations. Tutors can monitor their assigned students, while administrators manage users and tutor-student relationships.

## Live Application

**Production website:** https://studybuddy-ai-nine-neon.vercel.app

## Features

### Student Dashboard
- Organize subjects and study notes.
- Generate multiple-choice quizzes using OpenAI.
- Complete quizzes and receive automatically calculated scores.
- Review previous attempts and performance statistics.
- Identify weak and strong topics based on quiz answers.
- Generate AI-powered personalized study recommendations.
- View assigned projects, explain project understanding, and receive structured AI feedback.

### Tutor Dashboard
- View assigned students.
- Monitor student quiz results and learning progress.
- Analyze topics where students need additional practice.
- Access performance data only for authorized student assignments.
- Create projects with instructions, expected outcomes, and optional deadlines.
- Assign projects to students and review their understanding checks and AI analyses.

### Project Understanding Check

Project Understanding Check is a core feature of StudyBuddy AI. It helps Tutors evaluate whether Students understand the objectives of their assigned projects before starting the work.

The workflow consists of five steps:

1. **Project Creation:** A Tutor creates a project with a title, instructions, expected learning outcomes, and an optional deadline.
2. **Student Assignment:** The Tutor assigns the project to Students already linked to their account.
3. **Student Explanation:** Each assigned Student explains their understanding of the project in their own words.
4. **AI Analysis:** OpenAI compares the Student's explanation with the Tutor's expected outcomes and generates structured feedback.
5. **Tutor Review:** The Tutor can review the original explanation and AI-generated feedback from their dashboard.

The AI analysis identifies four elements:

- **AI Summary:** An overall assessment of the Student's understanding.
- **Understood Points:** Concepts that the Student explained correctly.
- **Missing Points:** Important concepts that were not sufficiently addressed.
- **Misunderstood Points:** Concepts that the Student explicitly explained incorrectly.

The results are stored in Supabase PostgreSQL and can be reviewed by authorized Tutors.

**Security and usage controls:**
- Project access is restricted using Supabase Row Level Security.
- Students can only access projects assigned to them.
- AI analyses are generated and saved through a server-side API.
- Students cannot directly modify AI-generated analysis fields.
- AI understanding analyses are limited to three requests per Student per UTC day.
- AI-generated feedback is advisory and should be reviewed by the Tutor.

### Admin Dashboard
- View registered users and their roles.
- Manage Student, Tutor, and Admin roles.
- Assign students to tutors.
- Remove existing tutor-student assignments.
- Manage access using role-based authorization.

## Technology Stack

| Technology | Purpose |
|---|---|
| Next.js | Full-stack web framework |
| React | User interface |
| TypeScript | Type-safe development |
| Tailwind CSS | Styling |
| Supabase | Authentication and PostgreSQL database |
| PostgreSQL | Persistent data storage |
| OpenAI API | AI-generated quizzes and study recommendations |
| Vercel | Production hosting and deployment |
| GitHub | Version control |

## Architecture

StudyBuddy AI follows a full-stack architecture:

- **Frontend:** Next.js and React.
- **Backend:** Next.js server-side routes and API endpoints.
- **Database:** Supabase PostgreSQL.
- **Authentication:** Supabase Auth.
- **Artificial Intelligence:** OpenAI API.
- **Deployment:** Vercel.

The application uses role-based access control and Supabase Row Level Security (RLS) policies to restrict access to protected data.

## Local Installation

### 1. Clone the repository

```bash
git clone https://github.com/kthanuseg-ui/studybuddy-ai.git
cd studybuddy-ai
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env.local` file in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
SUPABASE_SECRET_KEY=your_supabase_secret_key
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4.1-mini
```

**Security:** Never commit `.env.local` or expose server-side API keys in client-side code.

### 4. Configure the database

Create a Supabase project and execute the SQL migration files in `supabase/migrations/` in chronological order.

The migrations configure the database schema, access policies, profile management, and server-side functions required by the application.

Configure Supabase Authentication with the appropriate site URL and authorized redirect URLs.

### 5. Start the application

```bash
npm run dev
```

Open http://localhost:3000 in your browser.

## Quality Checks and Automated Tests

StudyBuddy AI includes TypeScript validation, ESLint checks, production build verification, and automated Supabase authorization tests.

### Code Quality

Run:

```bash
npx tsc --noEmit
npm run lint
npm run build

```

### Automated Security Tests

Run all automated tests using:

`npm test`

The test suite currently covers:

- **Tutor Authorization:** Tutors can read assigned student profiles but not unrelated student profiles.
- **Project Authorization:** Tutors can access their projects and AI analyses, while anonymous visitors cannot.
- **Student Isolation:** Unassigned students cannot read another student's projects, assignments, or AI analyses.

The tests use authenticated Supabase sessions and the public publishable key to verify Row Level Security policies.

### Test Configuration and Shared Fixtures

Configure the following variables in `.env.local`:

- `TEST_TUTOR_EMAIL`
- `TEST_TUTOR_PASSWORD`
- `TEST_UNASSIGNED_STUDENT_EMAIL`
- `TEST_UNASSIGNED_STUDENT_PASSWORD`

Shared fixtures are located in `tests/fixtures/project-understanding.mjs`.

The fixture retrieves project, student assignment, and AI analysis identifiers dynamically instead of using hard-coded UUIDs.

**Current limitation:** The integration tests depend on existing test accounts and a project named `Introduction to Data Analysis`, with exactly one assigned student and at least one saved analysis.

The tests are read-only but connect to the configured Supabase database. A dedicated test environment with independently created and cleaned-up fixtures is recommended.

## Security and Usage Limits

The application includes several security and resource-management mechanisms:

- Authentication is required for protected routes.
- Student, Tutor, and Admin permissions are enforced.
- Supabase RLS policies protect database records.
- Quiz evaluation and score calculation take place server-side.
- Quiz attempts and answers are saved through a PostgreSQL transaction.
- Sensitive API keys remain server-side.
- AI quiz generation is limited to five requests per student per UTC day.
- AI study recommendations are limited to three requests per student per UTC day.
- AI project understanding analyses are limited to three requests per student per UTC day.

These mechanisms provide application-level safeguards but do not replace comprehensive production security testing.

## Deployment

The application is deployed on Vercel and connected to the GitHub repository.

The production environment requires the Supabase and OpenAI environment variables listed above.

Supabase authentication redirect settings must be configured for the production domain.

## Project Purpose

StudyBuddy AI demonstrates how artificial intelligence and data analytics can support personalized education.

The project combines full-stack web development, secure database management, AI integration, and learning performance analysis in a unified platform.


## Project Status

**Deployed on Vercel — Core functionality implemented and tested.**

The application includes Student, Tutor, and Admin workflows, AI-powered quizzes, personalized recommendations, and Project Understanding Check.

The Project Understanding Check workflow has been tested end-to-end in development, including OpenAI analysis and Supabase persistence. Project visibility and Tutor access to saved results have also been verified on the production deployment.

Three automated Supabase authorization tests pass using `npm test`.

Future improvements include independently managed test fixtures, additional authorization tests, and persistent Student-side access to previous understanding analyses.


**Thanuseg Kannathasan**

Engineering Internship Project — AiLaB, Tokyo, Japan

2026