# AutoCRM

An AI-powered customer relationship management system built with React, TypeScript, and Supabase.

## Features

- 🔐 Secure authentication with role-based access control
- 🎫 Ticket management system with real-time updates
- 👥 User management for administrators
- 🤖 AI-assisted customer support features
- 📱 Responsive design with modern UI
- 🔄 Real-time updates using Supabase subscriptions

## Tech Stack

- React 18
- TypeScript
- Supabase (Authentication, Database, Real-time subscriptions)
- TailwindCSS
- Shadcn/ui Components
- React Router v6

## Getting Started

### Prerequisites

- Node.js 16+
- npm or yarn
- Supabase account and project

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/autocrm.git
cd autocrm
```

2. Install dependencies:
```bash
npm install
# or
yarn install
```

3. Create a `.env` file in the root directory with your Supabase credentials:
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. Start the development server:
```bash
npm run dev
# or
yarn dev
```

5. Open [http://localhost:5173](http://localhost:5173) to view the app

### Database Setup

1. Run the migrations in your Supabase project:
   - Navigate to the SQL editor in your Supabase dashboard
   - Run the migration files in the `supabase/migrations` directory in order

2. Set up the required tables:
   - profiles
   - tickets
   - ticket_notes

## Project Structure

```
src/
├── lib/            # Utility functions and hooks
├── modules/        # Feature modules
│   ├── auth/       # Authentication related components
│   ├── tickets/    # Ticket management
│   └── admin/      # Admin features
├── services/       # API and service layer
├── ui/            # Reusable UI components
└── types/         # TypeScript type definitions
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details

# Environment Variables

The following environment variables are required:

- `VITE_SUPABASE_URL`: Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: Your Supabase anonymous key
- `VITE_OPENAI_API_KEY`: Your OpenAI API key for AI features

Copy `.env.example` to `.env` and fill in your values.
