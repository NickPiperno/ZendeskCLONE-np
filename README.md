# AutoCRM

AutoCRM is an AI-powered Customer Relationship Management system that leverages generative AI to minimize support workload and enhance customer experience. By integrating existing help resources with LLM capabilities, AutoCRM delivers an interactive support and sales experience with minimal human involvement.

## Tech Stack

- **Frontend**: Vite + React with TypeScript
- **Styling**: Tailwind CSS + Shadcn UI
- **Backend**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Real-time Features**: Supabase Realtime
- **AI Integration**: OpenAI + LangChain
- **Testing**: Jest
- **Deployment**: AWS Amplify

## Getting Started

### Prerequisites

- Node.js (LTS version)
- npm or yarn
- Git

### Installation

1. Clone the repository:
```bash
git clone [repository-url]
cd autocrm
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
Create a `.env` file in the root directory with the following variables:
```env
SUPABASE_URL=your_supabase_url_here
SUPABASE_ANON_KEY=your_supabase_anon_key_here
OPENAI_API_KEY=your_openai_api_key_here
```

4. Start the development server:
```bash
npm run dev
```

## Core Features

- **Ticket Management System**: Advanced ticket tracking with flexible metadata
- **API-First Design**: Seamless integration capabilities
- **Employee Interface**: Efficient queue management and ticket handling
- **Administrative Control**: Team management and routing intelligence
- **Customer Portal**: Self-service tools and multi-channel support
- **AI-Powered Features**: Chatbots and personalized suggestions

## Project Structure

```
autocrm/
├─ src/
│  ├─ modules/           # Feature-based modules
│  │  ├─ tickets/       # Ticket management
│  │  ├─ auth/          # Authentication
│  │  └─ ...
│  ├─ ui/               # Shared UI components
│  ├─ services/         # API services
│  └─ utils/            # Helper functions
├─ docs/                # Documentation
├─ tests/               # Test files
└─ public/              # Static assets
```

## Development Guidelines

- Follow the mobile-first approach for responsive design
- Maintain accessibility standards (WCAG 2.1)
- Write tests for new features
- Follow the established coding style and conventions

## Contributing

1. Create a feature branch
2. Make your changes
3. Write or update tests
4. Submit a pull request

## License

[License Type] - See LICENSE file for details
