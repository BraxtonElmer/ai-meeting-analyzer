# MeetingSmart AI Assistant

An intelligent web portal for AI-powered meeting management that provides real-time transcription, collaborative tools, and advanced analytics.

## Features

- **Live Transcription**: Capture meeting discussions in real-time
- **AI-Powered Summaries**: Automatically generate meeting summaries
- **Task Management**: Create and assign tasks and action items
- **Chat Interface**: Ask questions about meeting content
- **Meeting Import**: Start transcription sessions from Google Meet links
- **Python Bot Integration**: Easily feed automated transcription data

## Tech Stack

- TypeScript React Frontend with ShadCN UI
- Express.js Backend
- WebSocket for real-time communication
- Drizzle ORM with PostgreSQL/MySQL for data persistence
- Google's Gemini AI for transcription analysis
- Authentication with secure password handling

## Setup Instructions

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later)
- [PostgreSQL](https://www.postgresql.org/download/) (v14 or later) or [MySQL](https://www.mysql.com/downloads/) (v8 or later)
- An API key for Google's Gemini AI (for AI features)

### Quick Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/yourusername/meetingsmart.git
   cd meetingsmart
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Create a `.env` file** in the project root with the following configuration:
   ```
   # Database configuration
   DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/meetingsmart
   
   # Gemini API key (required for AI features)
   GEMINI_API_KEY=your_gemini_api_key
   
   # Session secret for auth
   SESSION_SECRET=your_session_secret
   ```

4. **Set up your database**:
   ```bash
   # Create the database tables and schema
   npm run db:push
   
   # Seed the database with sample data
   npm run db:seed
   ```

5. **Start the development server**:
   ```bash
   npm run dev
   ```

6. **Access the application** at `http://localhost:5000`

### Login Credentials

The seeded database contains sample users. You can log in with:
- Username: `testuser`
- Password: `password123`

## Python Bot Integration

To use the Python bot for automated transcription:

1. Install the required Python packages:
   ```bash
   pip install requests
   ```

2. Run the provided Python script:
   ```bash
   python python_bot_example.py
   ```

3. The bot will send transcription entries to the API, simulating real-time speech-to-text

## Project Structure

- `/client` - React frontend application
- `/server` - Express API server
- `/db` - Database configuration and seeding
- `/shared` - Shared types and schemas
- `/public` - Static assets

## Development Commands

- `npm run dev` - Start development server
- `npm run db:push` - Push schema changes to database
- `npm run db:seed` - Seed database with sample data
- `npm run build` - Build for production
- `npm run start` - Run production server

## Troubleshooting

- **Database Connection Issues**: Ensure your database (PostgreSQL or MySQL) is running and your DATABASE_URL is correctly configured
- **AI Features Not Working**: Check your GEMINI_API_KEY is valid and correctly set in .env
- **Authentication Problems**: Clear cookies and try with default login credentials

## MySQL Support

This application now supports MySQL as an alternative to PostgreSQL. For detailed instructions on using MySQL, see the [MySQL Migration Guide](MySQL_MIGRATION.md).

## License

[MIT](LICENSE)