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

### Tutor Dashboard
- View assigned students.
- Monitor student quiz results and learning progress.
- Analyze topics where students need additional practice.
- Access performance data only for authorized student assignments.

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

## Quality Checks

Run the following commands to validate the project:

```bash
npx tsc --noEmit
npm run lint
npm run build
```

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

These mechanisms provide application-level safeguards but do not replace comprehensive production security testing.

## Deployment

The application is deployed on Vercel and connected to the GitHub repository.

The production environment requires the Supabase and OpenAI environment variables listed above.

Supabase authentication redirect settings must be configured for the production domain.

## Project Purpose

StudyBuddy AI demonstrates how artificial intelligence and data analytics can support personalized education.

The project combines full-stack web development, secure database management, AI integration, and learning performance analysis in a unified platform.

## Project Status

**Deployed and functionally tested.**

Core Student, Tutor, and Admin workflows have been tested on the production deployment. Further enhancements, usability improvements, and additional testing may be implemented as the project evolves.

## Author

**Thanuseg Kannathasan**

Engineering Internship Project — AiLaB, Tokyo, Japan

2026