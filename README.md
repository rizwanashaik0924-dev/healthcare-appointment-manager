# Healthcare Appointment & Follow-up Manager

A full-stack healthcare appointment platform that connects patients, doctors, and administrators. The system supports appointment booking, rescheduling, cancellation, AI-assisted symptom summaries, patient-friendly visit summaries, prescriptions, medication reminders, email notifications, and Google Calendar integration.

## Project Objective

The Healthcare Appointment & Follow-up Manager provides more than basic appointment booking. Patients can share symptoms before a visit, receive appointment confirmations and reminders, view visit summaries and prescribed medications, and receive medication reminders. Doctors can review appointments, see AI-assisted symptom summaries, accept or reject appointments, add clinical notes, and complete visits. Administrators can manage doctors, schedules, leaves, and appointments.

## Main Features

### Patient Portal

* Patient registration and login
* View personal information
* Book appointments with available doctors
* View available appointment slots
* Provide symptoms before appointments
* View booked appointments
* Reschedule appointments
* Cancel appointments
* View patient-friendly visit summaries
* View prescriptions
* Load prescribed medications
* View medication reminder times

### Doctor Portal

* Doctor login
* View patient appointments
* View patient symptoms
* AI-assisted pre-visit symptom summary
* View urgency level and suggested questions
* Accept appointments
* Reject appointments
* Add doctor notes
* Add prescriptions
* Complete appointments
* Generate patient-friendly post-visit summaries

### Admin Portal

* Manage doctors
* Add doctor profiles
* Configure working hours
* Configure appointment slot duration
* Add doctor leave
* Manage appointments
* View appointment information

### Notifications

* Appointment booking confirmation email
* Appointment acceptance email
* Appointment rejection email
* Appointment cancellation email
* Appointment rescheduling email
* 24-hour appointment reminder email
* Medication reminder email

### Google Calendar

* Google OAuth authentication
* Create calendar events for appointments
* Update calendar events when appointments are rescheduled
* Delete calendar events when appointments are cancelled

### AI Features

* Pre-visit symptom analysis
* Urgency classification
* Suggested questions for doctors
* Patient-friendly post-visit summary
* Medication schedule summary
* Follow-up instructions

## Technologies Used

### Frontend

* HTML5
* CSS3
* JavaScript

### Backend

* Node.js
* Express.js

### Database

* MySQL

### APIs and Services

* OpenAI API
* Google Calendar API
* Gmail SMTP / Nodemailer

### Other Tools

* bcrypt for password hashing
* express-session for session management
* node-cron for reminder jobs
* Git and GitHub for version control

## Project Structure

```text
healthcare-appointment-manager/
│
├── public/
│   ├── index.html
│   ├── patient.html
│   ├── doctor.html
│   ├── admin.html
│   ├── script.js
│   └── style.css
│
├── server.js
├── package.json
├── package-lock.json
├── .env.example
├── .gitignore
└── README.md


## Database

The project uses MySQL with the following main entities:

* `users`
* `doctor_profiles`
* `doctor_leave`
* `appointments`
* `medications`
* `medication_reminders`
* `notification_log`
* `calendar_events`

## How to Run Locally

### 1. Clone the repository

```bash
git clone https://github.com/rizwanashaik0924-dev/healthcare-appointment-manager.git
cd healthcare-appointment-manager
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file in the project root.

Use `.env.example` as a template.

Example:

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=health

OPENAI_API_KEY=your_openai_api_key

GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:5000/oauth2callback
GOOGLE_CALENDAR_SCOPE=https://www.googleapis.com/auth/calendar

SMTP_USER=your_gmail_address
SMTP_PASS=your_gmail_app_password
EMAIL_FROM=your_gmail_address

SESSION_SECRET=your_session_secret
```

Do not upload `.env` to GitHub.

### 4. Create the MySQL database

Create the database:

```sql
CREATE DATABASE health;
```

Make sure MySQL is running and the database credentials in `.env` are correct.

### 5. Start the application

```bash
node server.js
```

The application runs at:

```text
http://localhost:5000
```

## Application Pages

### Login

```text
http://localhost:5000/index.html
```

### Patient Portal

```text
http://localhost:5000/patient.html
```

### Doctor Portal

```text
http://localhost:5000/doctor.html
```

### Admin Portal

```text
http://localhost:5000/admin.html
```

## Appointment Workflow

```text
Patient books appointment
        ↓
AI pre-visit symptom summary
        ↓
Doctor accepts appointment
        ↓
Appointment scheduled
        ↓
Doctor completes visit
        ↓
Doctor notes + prescription
        ↓
AI patient-friendly visit summary
        ↓
Medication record created
        ↓
Medication reminder created
        ↓
Patient views medication
        ↓
Medication reminder email sent
```

## Security

* Passwords are hashed using bcrypt.
* Environment variables are stored in `.env`.
* `.env` is excluded using `.gitignore`.
* API credentials and passwords are not stored in source code.
* `.env.example` contains placeholders only.

## Testing Completed

The following features were tested successfully:

* Patient login and registration
* Doctor login
* Appointment booking
* Available slot generation
* Appointment acceptance and rejection
* Appointment rescheduling
* Appointment cancellation
* AI symptom summary
* Doctor notes and prescription
* Patient-friendly visit summary
* Medication creation
* Medication reminder email
* Appointment reminder email
* Google Calendar connection
* Google Calendar event creation
* Google Calendar rescheduling
* Google Calendar cancellation
* MySQL database integration

## Future Enhancements

* Production cloud deployment
* Online prescription downloads
* SMS notifications
* Role-based API authorization improvements
* Doctor search and filtering
* Appointment analytics dashboard
* Mobile application
* Secure cloud database hosting

## Author

**Rizwana Shaik**

Healthcare Appointment & Follow-up Manager
GitHub: https://github.com/rizwanashaik0924-dev/healthcare-appointment-manager
