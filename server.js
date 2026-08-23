const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const bcrypt = require("bcrypt");
const OpenAI = require("openai");
const nodemailer = require("nodemailer");
const cron = require("node-cron");
const { google } = require("googleapis");
const crypto = require("crypto");
const session = require("express-session");

require("dotenv").config();

const app = express();


// =====================================================
// MIDDLEWARE
// =====================================================

app.use(
    cors({
        origin: true,
        credentials: true
    })
);

app.use(express.json());

app.use(express.static("public"));

app.use(
    session({
        secret:
            process.env.SESSION_SECRET ||
            "healthcare-manager-local-secret",

        resave: false,

        saveUninitialized: false,

        cookie: {
            secure: false,
            httpOnly: true,
            maxAge: 24 * 60 * 60 * 1000
        }
    })
);


// =====================================================
// OPENAI
// =====================================================

let openai = null;

if (process.env.OPENAI_API_KEY) {

    openai = new OpenAI({
        apiKey:
            process.env.OPENAI_API_KEY
    });

    console.log(
        "OpenAI API key loaded successfully."
    );

} else {

    console.log(
        "WARNING: OPENAI_API_KEY is not configured."
    );

}


// =====================================================
// GOOGLE CALENDAR OAUTH
// =====================================================

let googleOAuthClient = null;

const GOOGLE_CALENDAR_SCOPE =
    process.env.GOOGLE_CALENDAR_SCOPE ||
    "https://www.googleapis.com/auth/calendar";

if (
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REDIRECT_URI
) {

    googleOAuthClient =
        new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI
        );

    console.log(
        "Google Calendar OAuth configured successfully."
    );

} else {

    console.log(
        "WARNING: Google Calendar OAuth is not configured."
    );

}


// =====================================================
// EMAIL / NODEMAILER
// =====================================================

let mailTransporter = null;

if (
    process.env.SMTP_USER &&
    process.env.SMTP_PASS
) {

    mailTransporter =
        nodemailer.createTransport({

            service:
                "gmail",

            auth: {

                user:
                    process.env.SMTP_USER,

                pass:
                    process.env.SMTP_PASS

            }

        });

    console.log(
        "Email transporter configured successfully."
    );

} else {

    console.log(
        "WARNING: SMTP_USER or SMTP_PASS is missing."
    );

}


// =====================================================
// VERIFY EMAIL CONNECTION
// =====================================================

async function verifyEmailTransporter() {

    if (!mailTransporter) {
        return;
    }

    try {

        await mailTransporter.verify();

        console.log(
            "Gmail SMTP connection verified successfully."
        );

    } catch (error) {

        console.error(
            "Gmail SMTP verification failed:"
        );

        console.error(
            error.message
        );

    }

}


// =====================================================
// EMAIL HELPER
// =====================================================

async function sendEmail({
    to,
    subject,
    text,
    html
}) {

    if (!mailTransporter) {

        console.log(
            "Email skipped: transporter is not configured."
        );

        return {

            success:
                false,

            error:
                "Email transporter is not configured."

        };

    }

    if (!to) {

        console.log(
            "Email skipped: recipient email is missing."
        );

        return {

            success:
                false,

            error:
                "Recipient email is missing."

        };

    }

    try {

        const info =
            await mailTransporter.sendMail({

                from:
                    process.env.EMAIL_FROM ||
                    process.env.SMTP_USER,

                to:
                    to,

                subject:
                    subject,

                text:
                    text,

                html:
                    html ||
                    undefined

            });

        console.log(
            "Email sent successfully:",
            to,
            info.messageId
        );

        return {

            success:
                true,

            messageId:
                info.messageId

        };

    } catch (error) {

        console.error(
            "Email sending failed to:",
            to
        );

        console.error(
            "Email error:",
            error.message
        );

        return {

            success:
                false,

            error:
                error.message

        };

    }

}


// =====================================================
// MYSQL CONNECTION
// =====================================================

const db = mysql.createConnection({

    host:
        process.env.DB_HOST || "localhost",

    user:
        process.env.DB_USER || "root",

    password:
        process.env.DB_PASSWORD,

    database:
        process.env.DB_NAME || "health"

});


db.connect((err) => {

    if (err) {

        console.log(
            "MySQL connection failed:",
            err.message
        );

    } else {

        console.log(
            "MySQL connected successfully!"
        );

        initializeNotificationTable();

        initializeCalendarTable();

    }

});


// =====================================================
// DATABASE QUERY HELPER
// =====================================================

function runQuery(
    sql,
    params = []
) {

    return new Promise(
        (
            resolve,
            reject
        ) => {

            db.query(
                sql,
                params,
                (
                    error,
                    results
                ) => {

                    if (error) {

                        reject(error);

                    } else {

                        resolve(results);

                    }

                }
            );

        }
    );

}


// =====================================================
// NOTIFICATION LOG TABLE
// =====================================================

function initializeNotificationTable() {

    const sql = `
        CREATE TABLE IF NOT EXISTS notification_log (

            id INT AUTO_INCREMENT PRIMARY KEY,

            appointment_id INT NOT NULL,

            recipient_email VARCHAR(255) NOT NULL,

            notification_type VARCHAR(100) NOT NULL,

            sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,

            UNIQUE KEY unique_notification
            (
                appointment_id,
                recipient_email,
                notification_type
            )

        )
    `;

    db.query(
        sql,
        (err) => {

            if (err) {

                console.error(
                    "Notification table creation failed:",
                    err.message
                );

            } else {

                console.log(
                    "Notification log table ready."
                );

            }

        }
    );

}


// =====================================================
// GOOGLE CALENDAR EVENTS TABLE
// =====================================================

function initializeCalendarTable() {

    const sql = `
        CREATE TABLE IF NOT EXISTS calendar_events (

            id INT AUTO_INCREMENT PRIMARY KEY,

            appointment_id INT NOT NULL,

            google_event_id VARCHAR(500) NOT NULL,

            google_account_email VARCHAR(255),

            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

            UNIQUE KEY unique_appointment_calendar
            (
                appointment_id,
                google_account_email
            )

        )
    `;

    db.query(
        sql,
        (err) => {

            if (err) {

                console.error(
                    "Calendar table creation failed:",
                    err.message
                );

            } else {

                console.log(
                    "Calendar events table ready."
                );

            }

        }
    );

}


// =====================================================
// TEST
// =====================================================

app.get(
    "/",
    (req, res) => {

        res.json({

            message:
                "Healthcare Manager Backend is running!"

        });

    }
);


// =====================================================
// TEST EMAIL
// =====================================================

app.get(
    "/test-email",
    async (req, res) => {

        if (!mailTransporter) {

            return res.status(500).json({

                success:
                    false,

                error:
                    "Email transporter is not configured. Check SMTP_USER and SMTP_PASS in .env."

            });

        }

        const result =
            await sendEmail({

                to:
                    process.env.SMTP_USER,

                subject:
                    "Healthcare Manager Test Email",

                text:
                    `
Email service is working successfully.

Healthcare Appointment & Follow-up Manager

This is a test email from your local application.
                    `.trim()

            });

        if (!result.success) {

            return res.status(500).json({

                success:
                    false,

                error:
                    result.error

            });

        }

        return res.json({

            success:
                true,

            message:
                "Test email sent successfully.",

            messageId:
                result.messageId

        });

    }
);


// =====================================================
// OPENAI TEST
// =====================================================

app.get(
    "/test-openai",
    async (req, res) => {

        if (!openai) {

            return res.status(500).json({

                success:
                    false,

                error:
                    "OPENAI_API_KEY is not configured in .env"

            });

        }

        try {

            const response =
                await openai.responses.create({

                    model:
                        "gpt-5.6-luna",

                    input:
                        "Reply with exactly: OpenAI connection successful."

                });

            return res.json({

                success:
                    true,

                message:
                    response.output_text

            });

        } catch (error) {

            console.error(
                "OpenAI test failed:",
                error.message
            );

            return res.status(500).json({

                success:
                    false,

                error:
                    error.message ||
                    "OpenAI request failed"

            });

        }

    }
);


// =====================================================
// GOOGLE CALENDAR AUTH
// =====================================================

app.get(
    "/google-calendar/auth",
    (req, res) => {

        if (!googleOAuthClient) {

            return res.status(500).send(
                "Google Calendar OAuth is not configured. Check your .env."
            );

        }

        const state =
            crypto
                .randomBytes(32)
                .toString("hex");

        req.session.googleOAuthState =
            state;

        const authUrl =
            googleOAuthClient.generateAuthUrl({

                access_type:
                    "offline",

                prompt:
                    "consent",

                scope:
                    [
                        GOOGLE_CALENDAR_SCOPE
                    ],

                state:
                    state

            });

        return res.redirect(
            authUrl
        );

    }
);


// =====================================================
// GOOGLE CALENDAR CALLBACK
// =====================================================

app.get(
    "/oauth2callback",
    async (req, res) => {

        if (!googleOAuthClient) {

            return res.status(500).send(
                "Google Calendar OAuth is not configured."
            );

        }

        const {
            code,
            state,
            error
        } = req.query;

        if (error) {

            return res.status(400).send(
                `Google authorization failed: ${error}`
            );

        }

        if (
            !state ||
            state !==
            req.session.googleOAuthState
        ) {

            return res.status(400).send(
                "Invalid OAuth state."
            );

        }

        if (!code) {

            return res.status(400).send(
                "Authorization code was not provided."
            );

        }

        try {

            const {
                tokens
            } =
                await googleOAuthClient.getToken(
                    String(code)
                );

            googleOAuthClient.setCredentials(
                tokens
            );

            req.session.googleCalendarTokens =
                tokens;

            req.session.googleCalendarConnected =
                true;

            delete req.session.googleOAuthState;

            let connectedEmail =
                "";

            try {

                const oauth2 =
                    google.oauth2({

                        auth:
                            googleOAuthClient,

                        version:
                            "v2"

                    });

                const userInfo =
                    await oauth2.userinfo.get();

                connectedEmail =
                    userInfo.data.email ||
                    "";

                req.session.googleCalendarEmail =
                    connectedEmail;

            } catch (profileError) {

                console.log(
                    "Google account email lookup failed:",
                    profileError.message
                );

            }

            return res.send(`
                <!DOCTYPE html>
                <html>

                <head>
                    <title>Google Calendar Connected</title>
                </head>

                <body
                    style="
                        font-family: Arial;
                        padding: 40px;
                    "
                >

                    <h2>
                        Google Calendar connected successfully ✅
                    </h2>

                    <p>
                        Your Healthcare Appointment Manager
                        is now connected to Google Calendar.
                    </p>

                    ${
                        connectedEmail
                            ? `<p>Connected account: ${connectedEmail}</p>`
                            : ""
                    }

                    <p>
                        You can close this page and return
                        to your application.
                    </p>

                </body>

                </html>
            `);

        } catch (oauthError) {

            console.error(
                "Google OAuth token exchange failed:",
                oauthError.message
            );

            return res.status(500).send(
                "Google Calendar authorization failed."
            );

        }

    }
);


// =====================================================
// GOOGLE CALENDAR STATUS
// =====================================================

app.get(
    "/google-calendar/status",
    (req, res) => {

        return res.json({

            connected:
                !!req.session.googleCalendarConnected,

            email:
                req.session.googleCalendarEmail ||
                null

        });

    }
);


// =====================================================
// GET GOOGLE CALENDAR CLIENT
// =====================================================

function getGoogleCalendarClientFromSession(
    req
) {

    if (
        !googleOAuthClient ||
        !req.session.googleCalendarTokens
    ) {

        return null;

    }

    const client =
        new google.auth.OAuth2(

            process.env.GOOGLE_CLIENT_ID,

            process.env.GOOGLE_CLIENT_SECRET,

            process.env.GOOGLE_REDIRECT_URI

        );

    client.setCredentials(
        req.session.googleCalendarTokens
    );

    return client;

}


// =====================================================
// CREATE GOOGLE CALENDAR EVENT
// =====================================================

async function createGoogleCalendarEvent(
    req,
    appointmentId
) {

    const auth =
        getGoogleCalendarClientFromSession(
            req
        );

    if (!auth) {

        console.log(
            "Google Calendar event skipped: no connected Google account."
        );

        return {

            success:
                false,

            error:
                "Google Calendar is not connected."

        };

    }

    try {

        const rows =
            await runQuery(
                `
                SELECT

                    a.id,
                    a.appointment_date,
                    a.appointment_time,
                    a.symptoms,

                    p.name AS patient_name,
                    p.email AS patient_email,

                    d.name AS doctor_name,
                    d.email AS doctor_email,

                    dp.slot_duration

                FROM appointments a

                JOIN users p
                    ON a.patient_id = p.id

                JOIN users d
                    ON a.doctor_id = d.id

                LEFT JOIN doctor_profiles dp
                    ON dp.doctor_id = a.doctor_id

                WHERE a.id = ?

                LIMIT 1
                `,
                [
                    appointmentId
                ]
            );

        if (
            rows.length ===
            0
        ) {

            return {

                success:
                    false,

                error:
                    "Appointment not found."

            };

        }

        const appointment =
            rows[0];

        const startDate =
            parseAppointmentDateTime(
                appointment.appointment_date,
                appointment.appointment_time
            );

        if (
            Number.isNaN(
                startDate.getTime()
            )
        ) {

            return {

                success:
                    false,

                error:
                    "Invalid appointment date or time."

            };

        }

        const duration =
            Number(
                appointment.slot_duration ||
                30
            );

        const endDate =
            new Date(
                startDate.getTime() +
                duration * 60 * 1000
            );

        const calendar =
            google.calendar({

                version:
                    "v3",

                auth:
                    auth

            });

        const event = {

            summary:
                `Healthcare Appointment - Dr. ${appointment.doctor_name}`,

            description:
                `
Healthcare Appointment & Follow-up Manager

Patient:
${appointment.patient_name}

Symptoms:
${appointment.symptoms || "Not provided"}

Doctor:
Dr. ${appointment.doctor_name}
                `.trim(),

            start: {

                dateTime:
                    startDate.toISOString(),

                timeZone:
                    "Asia/Kolkata"

            },

            end: {

                dateTime:
                    endDate.toISOString(),

                timeZone:
                    "Asia/Kolkata"

            },

            attendees: [

                {
                    email:
                        appointment.patient_email
                },

                {
                    email:
                        appointment.doctor_email
                }

            ]

        };

        const response =
            await calendar.events.insert({

                calendarId:
                    "primary",

                requestBody:
                    event,

                sendUpdates:
                    "all"

            });

        const eventId =
            response.data.id;

        const googleEmail =
            req.session.googleCalendarEmail ||
            null;

        await runQuery(
            `
            INSERT INTO calendar_events
            (
                appointment_id,
                google_event_id,
                google_account_email
            )

            VALUES (?, ?, ?)

            ON DUPLICATE KEY UPDATE

                google_event_id =
                    VALUES(google_event_id),

                google_account_email =
                    VALUES(google_account_email)
            `,
            [
                appointmentId,
                eventId,
                googleEmail
            ]
        );

        console.log(
            "Google Calendar event created:",
            eventId
        );

        return {

            success:
                true,

            eventId:
                eventId

        };

    } catch (error) {

        console.error(
            "Google Calendar event creation failed:",
            error.message
        );

        return {

            success:
                false,

            error:
                error.message

        };

    }

}


// =====================================================
// DELETE GOOGLE CALENDAR EVENTS
// =====================================================

async function deleteGoogleCalendarEvents(
    req,
    appointmentId
) {

    const auth =
        getGoogleCalendarClientFromSession(
            req
        );

    if (!auth) {

        return false;

    }

    try {

        const events =
            await runQuery(
                `
                SELECT
                    id,
                    google_event_id

                FROM calendar_events

                WHERE appointment_id = ?
                `,
                [
                    appointmentId
                ]
            );

        if (
            events.length ===
            0
        ) {

            return false;

        }

        const calendar =
            google.calendar({

                version:
                    "v3",

                auth:
                    auth

            });

        let deleted =
            false;

        for (
            const event
            of events
        ) {

            try {

                await calendar.events.delete({

                    calendarId:
                        "primary",

                    eventId:
                        event.google_event_id,

                    sendUpdates:
                        "all"

                });

                deleted =
                    true;

            } catch (deleteError) {

                console.error(
                    "Google Calendar delete failed:",
                    deleteError.message
                );

            }

            await runQuery(
                `
                DELETE FROM calendar_events
                WHERE id = ?
                `,
                [
                    event.id
                ]
            );

        }

        return deleted;

    } catch (error) {

        console.error(
            "Google Calendar cleanup failed:",
            error.message
        );

        return false;

    }

}


// =====================================================
// DATE/TIME HELPERS
// =====================================================

function parseAppointmentDateTime(
    dateValue,
    timeValue
) {

    const dateText =
        formatDateOnly(
            dateValue
        );

    const timeText =
        String(
            timeValue
        ).slice(
            0,
            8
        );

    return new Date(
        `${dateText}T${timeText}+05:30`
    );

}


function formatDateOnly(
    value
) {

    if (
        value instanceof Date
    ) {

        return value
            .toISOString()
            .slice(
                0,
                10
            );

    }

    return String(
        value
    ).slice(
        0,
        10
    );

}


// =====================================================
// USERS
// =====================================================

app.get(
    "/users",
    async (req, res) => {

        try {

            const results =
                await runQuery(
                    `
                    SELECT
                        id,
                        name,
                        email,
                        role

                    FROM users

                    ORDER BY id
                    `
                );

            return res.json(
                results
            );

        } catch (error) {

            return res.status(500).json({

                error:
                    error.message

            });

        }

    }
);


// =====================================================
// REGISTER
// =====================================================

app.post(
    "/users",
    async (req, res) => {

        const {
            name,
            email,
            password,
            role
        } = req.body;

        if (
            !name ||
            !email ||
            !password ||
            !role
        ) {

            return res.status(400).json({

                error:
                    "All fields are required"

            });

        }

        const allowedRoles = [
            "patient",
            "doctor"
        ];

        if (
            !allowedRoles.includes(
                role
            )
        ) {

            return res.status(400).json({

                error:
                    "Invalid role"

            });

        }

        try {

            const hashedPassword =
                await bcrypt.hash(
                    password,
                    10
                );

            const sql = `
                INSERT INTO users
                (
                    name,
                    email,
                    password,
                    role
                )

                VALUES (?, ?, ?, ?)
            `;

            db.query(
                sql,
                [
                    name,
                    email,
                    hashedPassword,
                    role
                ],
                (err, result) => {

                    if (err) {

                        if (
                            err.code ===
                            "ER_DUP_ENTRY"
                        ) {

                            return res.status(409).json({

                                error:
                                    "Email already exists"

                            });

                        }

                        return res.status(500).json({

                            error:
                                err.message

                        });

                    }

                    return res.status(201).json({

                        message:
                            "User created successfully",

                        userId:
                            result.insertId

                    });

                }
            );

        } catch (error) {

            return res.status(500).json({

                error:
                    "Password encryption failed"

            });

        }

    }
);


// =====================================================
// LOGIN
// =====================================================

app.post(
    "/login",
    (req, res) => {

        const {
            email,
            password
        } = req.body;

        if (
            !email ||
            !password
        ) {

            return res.status(400).json({

                error:
                    "Email and password are required"

            });

        }

        const sql = `
            SELECT *

            FROM users

            WHERE email = ?

            LIMIT 1
        `;

        db.query(
            sql,
            [email],
            async (
                err,
                results
            ) => {

                if (err) {

                    return res.status(500).json({

                        error:
                            err.message

                    });

                }

                if (
                    results.length ===
                    0
                ) {

                    return res.status(401).json({

                        error:
                            "Invalid email or password"

                    });

                }

                const user =
                    results[0];

                try {

                    const passwordMatch =
                        await bcrypt.compare(
                            password,
                            user.password
                        );

                    if (!passwordMatch) {

                        return res.status(401).json({

                            error:
                                "Invalid email or password"

                        });

                    }

                    return res.json({

                        message:
                            "Login successful",

                        user: {

                            id:
                                user.id,

                            name:
                                user.name,

                            email:
                                user.email,

                            role:
                                user.role

                        }

                    });

                } catch (error) {

                    return res.status(500).json({

                        error:
                            "Login failed"

                    });

                }

            }
        );

    }
);


// =====================================================
// GET ALL DOCTORS
// =====================================================

app.get(
    "/doctors",
    async (req, res) => {

        try {

            const results =
                await runQuery(
                    `
                    SELECT

                        u.id,
                        u.name,
                        u.email,

                        d.specialisation,
                        d.working_start,
                        d.working_end,
                        d.slot_duration

                    FROM users u

                    JOIN doctor_profiles d
                        ON u.id = d.doctor_id

                    WHERE u.role = 'doctor'

                    ORDER BY u.name
                    `
                );

            return res.json(
                results
            );

        } catch (error) {

            return res.status(500).json({

                error:
                    error.message

            });

        }

    }
);


// =====================================================
// ADD DOCTOR
// =====================================================

app.post(
    "/admin/doctors",
    async (req, res) => {

        const {
            name,
            email,
            password,
            specialisation,
            working_start,
            working_end,
            slot_duration
        } = req.body;

        if (
            !name ||
            !email ||
            !password ||
            !specialisation ||
            !working_start ||
            !working_end ||
            !slot_duration
        ) {

            return res.status(400).json({

                error:
                    "All doctor fields are required"

            });

        }

        const duration =
            Number(slot_duration);

        if (
            !Number.isInteger(duration) ||
            duration <= 0
        ) {

            return res.status(400).json({

                error:
                    "Slot duration must be a positive number."

            });

        }

        try {

            const hashedPassword =
                await bcrypt.hash(
                    password,
                    10
                );

            db.beginTransaction(
                (transactionError) => {

                    if (transactionError) {

                        return res.status(500).json({

                            error:
                                transactionError.message

                        });

                    }

                    const userSql = `
                        INSERT INTO users
                        (
                            name,
                            email,
                            password,
                            role
                        )

                        VALUES (?, ?, ?, 'doctor')
                    `;

                    db.query(
                        userSql,
                        [
                            name,
                            email,
                            hashedPassword
                        ],
                        (
                            err,
                            result
                        ) => {

                            if (err) {

                                return db.rollback(
                                    () => {

                                        if (
                                            err.code ===
                                            "ER_DUP_ENTRY"
                                        ) {

                                            return res.status(409).json({

                                                error:
                                                    "Doctor email already exists"

                                            });

                                        }

                                        return res.status(500).json({

                                            error:
                                                err.message

                                        });

                                    }
                                );

                            }

                            const doctorId =
                                result.insertId;

                            const profileSql = `
                                INSERT INTO doctor_profiles
                                (
                                    doctor_id,
                                    specialisation,
                                    working_start,
                                    working_end,
                                    slot_duration
                                )

                                VALUES (?, ?, ?, ?, ?)
                            `;

                            db.query(
                                profileSql,
                                [
                                    doctorId,
                                    specialisation,
                                    working_start,
                                    working_end,
                                    duration
                                ],
                                (
                                    profileError
                                ) => {

                                    if (
                                        profileError
                                    ) {

                                        return db.rollback(
                                            () => {

                                                return res.status(500).json({

                                                    error:
                                                        profileError.message

                                                });

                                            }
                                        );

                                    }

                                    db.commit(
                                        (
                                            commitError
                                        ) => {

                                            if (
                                                commitError
                                            ) {

                                                return db.rollback(
                                                    () => {

                                                        return res.status(500).json({

                                                            error:
                                                                commitError.message

                                                        });

                                                    }
                                                );

                                            }

                                            return res.status(201).json({

                                                message:
                                                    "Doctor created successfully",

                                                doctorId:
                                                    doctorId

                                            });

                                        }
                                    );

                                }
                            );

                        }
                    );

                }
            );

        } catch (error) {

            return res.status(500).json({

                error:
                    error.message ||
                    "Doctor creation failed"

            });

        }

    }
);


// =====================================================
// ADD DOCTOR LEAVE
// =====================================================

app.post(
    "/doctors/:doctorId/leave",
    async (req, res) => {

        const doctorId =
            Number(
                req.params.doctorId
            );

        const {
            leave_date,
            reason
        } = req.body;

        if (
            !Number.isInteger(
                doctorId
            ) ||
            doctorId <= 0
        ) {

            return res.status(400).json({

                error:
                    "Invalid doctor ID"

            });

        }

        if (!leave_date) {

            return res.status(400).json({

                error:
                    "Leave date is required"

            });

        }

        try {

            await runQuery(
                `
                INSERT INTO doctor_leave
                (
                    doctor_id,
                    leave_date,
                    reason
                )

                VALUES (?, ?, ?)
                `,
                [
                    doctorId,
                    leave_date,
                    reason || null
                ]
            );

            const appointments =
                await runQuery(
                    `
                    SELECT

                        a.id,
                        a.patient_id,
                        a.appointment_date,
                        a.appointment_time,

                        p.email AS patient_email,
                        p.name AS patient_name,

                        d.email AS doctor_email,
                        d.name AS doctor_name

                    FROM appointments a

                    JOIN users p
                        ON a.patient_id = p.id

                    JOIN users d
                        ON a.doctor_id = d.id

                    WHERE a.doctor_id = ?

                    AND a.appointment_date = ?

                    AND a.status IN
                    (
                        'pending',
                        'accepted',
                        'confirmed'
                    )
                    `,
                    [
                        doctorId,
                        leave_date
                    ]
                );

            if (
                appointments.length ===
                0
            ) {

                return res.json({

                    message:
                        "Leave added successfully. No affected appointments.",

                    affectedAppointments:
                        0

                });

            }

            let completed =
                0;

            for (
                const appointment
                of appointments
            ) {

                await runQuery(
                    `
                    UPDATE appointments

                    SET status = 'cancelled'

                    WHERE id = ?
                    `,
                    [
                        appointment.id
                    ]
                );

                await deleteGoogleCalendarEvents(
                    req,
                    appointment.id
                );

                await sendEmail({

                    to:
                        appointment.patient_email,

                    subject:
                        "Appointment Cancelled - Doctor Leave",

                    text: `
Hello ${appointment.patient_name},

Your appointment with Dr. ${appointment.doctor_name}
scheduled for ${appointment.appointment_date}
at ${appointment.appointment_time}
has been cancelled because the doctor is on leave.

Please log in to the Healthcare Appointment Manager
to book another available appointment.

Thank you.
                    `.trim()

                });

                await sendEmail({

                    to:
                        appointment.doctor_email,

                    subject:
                        "Appointment Cancelled - Doctor Leave",

                    text: `
Hello Dr. ${appointment.doctor_name},

The appointment with ${appointment.patient_name}
scheduled for ${appointment.appointment_date}
at ${appointment.appointment_time}
has been cancelled because you are on leave.

Healthcare Appointment Manager
                    `.trim()

                });

                completed++;

            }

            return res.json({

                message:
                    "Leave added successfully and affected appointments were cancelled.",

                affectedAppointments:
                    completed

            });

        } catch (error) {

            if (
                error.code ===
                "ER_DUP_ENTRY"
            ) {

                return res.status(409).json({

                    error:
                        "Doctor is already on leave on this date"

                });

            }

            return res.status(500).json({

                error:
                    error.message

            });

        }

    }
);


// =====================================================
// GET DOCTOR LEAVE
// =====================================================

app.get(
    "/doctors/:doctorId/leave",
    async (req, res) => {

        const doctorId =
            Number(
                req.params.doctorId
            );

        if (
            !Number.isInteger(
                doctorId
            ) ||
            doctorId <= 0
        ) {

            return res.status(400).json({

                error:
                    "Invalid doctor ID"

            });

        }

        try {

            const results =
                await runQuery(
                    `
                    SELECT *

                    FROM doctor_leave

                    WHERE doctor_id = ?

                    ORDER BY leave_date
                    `,
                    [
                        doctorId
                    ]
                );

            return res.json(
                results
            );

        } catch (error) {

            return res.status(500).json({

                error:
                    error.message

            });

        }

    }
);


// =====================================================
// TIME HELPERS
// =====================================================

function timeToMinutes(
    time
) {

    const parts =
        String(
            time
        ).split(":");

    if (
        parts.length < 2
    ) {

        return NaN;

    }

    const hours =
        Number(parts[0]);

    const minutes =
        Number(parts[1]);

    if (
        !Number.isFinite(hours) ||
        !Number.isFinite(minutes)
    ) {

        return NaN;

    }

    return (
        hours * 60 +
        minutes
    );

}


function minutesToTime(
    minutes
) {

    const hours =
        Math.floor(
            minutes / 60
        );

    const mins =
        minutes % 60;

    return (
        String(hours).padStart(
            2,
            "0"
        ) +
        ":" +
        String(mins).padStart(
            2,
            "0"
        )
    );

}


// =====================================================
// AVAILABLE SLOTS
// =====================================================

app.get(
    "/doctors/:doctorId/slots",
    async (req, res) => {

        const doctorId =
            Number(
                req.params.doctorId
            );

        const {
            date
        } = req.query;

        if (
            !Number.isInteger(
                doctorId
            ) ||
            doctorId <= 0
        ) {

            return res.status(400).json({

                error:
                    "Invalid doctor ID"

            });

        }

        if (!date) {

            return res.status(400).json({

                error:
                    "Date is required"

            });

        }

        try {

            const doctors =
                await runQuery(
                    `
                    SELECT

                        working_start,
                        working_end,
                        slot_duration

                    FROM doctor_profiles

                    WHERE doctor_id = ?

                    LIMIT 1
                    `,
                    [
                        doctorId
                    ]
                );

            if (
                doctors.length ===
                0
            ) {

                return res.status(404).json({

                    error:
                        "Doctor profile not found"

                });

            }

            const doctor =
                doctors[0];

            const leave =
                await runQuery(
                    `
                    SELECT
                        id

                    FROM doctor_leave

                    WHERE doctor_id = ?

                    AND leave_date = ?

                    LIMIT 1
                    `,
                    [
                        doctorId,
                        date
                    ]
                );

            if (
                leave.length >
                0
            ) {

                return res.json({

                    date:
                        date,

                    available:
                        false,

                    message:
                        "Doctor is on leave",

                    slots:
                        []

                });

            }

            const booked =
                await runQuery(
                    `
                    SELECT
                        appointment_time

                    FROM appointments

                    WHERE doctor_id = ?

                    AND appointment_date = ?

                    AND status IN
                    (
                        'pending',
                        'accepted',
                        'confirmed'
                    )
                    `,
                    [
                        doctorId,
                        date
                    ]
                );

            const bookedTimes =
                booked.map(
                    item =>
                        String(
                            item.appointment_time
                        ).substring(
                            0,
                            5
                        )
                );

            const slots =
                [];

            let current =
                timeToMinutes(
                    doctor.working_start
                );

            const end =
                timeToMinutes(
                    doctor.working_end
                );

            const duration =
                Number(
                    doctor.slot_duration
                );

            while (
                Number.isFinite(current) &&
                Number.isFinite(end) &&
                duration > 0 &&
                current +
                duration <=
                end
            ) {

                const slot =
                    minutesToTime(
                        current
                    );

                if (
                    !bookedTimes.includes(
                        slot
                    )
                ) {

                    slots.push(
                        slot
                    );

                }

                current +=
                    duration;

            }

            return res.json({

                date:
                    date,

                available:
                    true,

                slots:
                    slots

            });

        } catch (error) {

            return res.status(500).json({

                error:
                    error.message

            });

        }

    }
);


// =====================================================
// AI PRE-VISIT SYMPTOM SUMMARY
// =====================================================

async function generateAISymptomSummary(
    symptoms
) {

    if (!openai) {
        return null;
    }

    if (
        !symptoms ||
        String(symptoms).trim().length === 0
    ) {

        return null;

    }

    try {

        const prompt = `
You are assisting a doctor with pre-visit review.

Analyze ONLY the symptoms supplied by the patient.

Do NOT diagnose the patient.
Do NOT recommend medication.
Do NOT replace a doctor.

Return ONLY valid JSON.

Required format:

{
  "urgency": "Low",
  "chief_complaint": "short description",
  "suggested_questions": [
    "question 1",
    "question 2",
    "question 3"
  ]
}

Rules:

1. urgency MUST be exactly one of:
Low
Medium
High

2. chief_complaint must be short.

3. suggested_questions must contain exactly 3 questions.

4. Base the response only on the symptoms.

5. If the symptoms could indicate a potentially serious situation,
use High.

6. This is decision support only.

Patient symptoms:
${String(symptoms).trim()}
        `.trim();

        const response =
            await openai.responses.create({

                model:
                    "gpt-5.6-luna",

                input:
                    prompt

            });

        const output =
            response.output_text;

        if (!output) {

            throw new Error(
                "OpenAI returned an empty response."
            );

        }

        const cleaned =
            output
                .replace(
                    /```json/gi,
                    ""
                )
                .replace(
                    /```/g,
                    ""
                )
                .trim();

        const result =
            JSON.parse(
                cleaned
            );

        const urgencyValues = [
            "Low",
            "Medium",
            "High"
        ];

        const urgency =
            urgencyValues.includes(
                result.urgency
            )
                ? result.urgency
                : "Low";

        const chiefComplaint =
            result.chief_complaint ||
            "Symptoms reported by patient.";

        let questions =
            Array.isArray(
                result.suggested_questions
            )
                ? result.suggested_questions
                    .filter(
                        question =>
                            typeof question ===
                                "string" &&
                            question.trim().length >
                                0
                    )
                    .slice(
                        0,
                        3
                    )
                : [];

        while (
            questions.length <
            3
        ) {

            questions.push(
                "Can you describe when the symptoms started?"
            );

        }

        return {

            urgency:
                urgency,

            chief_complaint:
                chiefComplaint,

            suggested_questions:
                questions

        };

    } catch (error) {

        console.error(
            "AI SYMPTOM SUMMARY ERROR:",
            error.message
        );

        return null;

    }

}


// =====================================================
// AI POST-VISIT SUMMARY
// =====================================================

async function generateAIPostVisitSummary(
    doctorNotes,
    prescription
) {

    if (!openai) {
        return null;
    }

    try {

        const prompt = `
Convert these clinical notes into a patient-friendly
post-visit summary.

Do NOT diagnose anything that is not explicitly stated.
Do NOT invent medications, doses, schedules, or medical facts.
Use simple language.
Do not replace the doctor's instructions.

Return ONLY valid JSON:

{
  "summary": "",
  "medication_schedule": "",
  "follow_up_steps": ""
}

Clinical Notes:
${doctorNotes || "No additional doctor notes provided."}

Prescription:
${prescription || "No prescription provided."}
        `.trim();

        const response =
            await openai.responses.create({

                model:
                    "gpt-5.6-luna",

                input:
                    prompt

            });

        const output =
            response.output_text;

        if (!output) {

            throw new Error(
                "OpenAI returned an empty response."
            );

        }

        const cleaned =
            output
                .replace(
                    /```json/gi,
                    ""
                )
                .replace(
                    /```/g,
                    ""
                )
                .trim();

        const result =
            JSON.parse(
                cleaned
            );

        return {

            summary:
                result.summary ||
                "Your visit was completed successfully.",

            medication_schedule:
                result.medication_schedule ||
                "No medication schedule was provided.",

            follow_up_steps:
                result.follow_up_steps ||
                "Follow your doctor's recommendations."

        };

    } catch (error) {

        console.error(
            "AI POST-VISIT SUMMARY ERROR:",
            error.message
        );

        return null;

    }

}


// =====================================================
// MEDICATION PARSING
// =====================================================

function extractTimesFromText(
    text
) {

    const matches =
        String(
            text ||
            ""
        ).match(
            /\b([01]?\d|2[0-3]):([0-5]\d)\b/g
        ) || [];

    return [
        ...new Set(
            matches.map(
                time =>
                    time
                        .split(":")
                        .map(
                            part =>
                                part.padStart(
                                    2,
                                    "0"
                                )
                        )
                        .join(":")
            )
        )
    ];

}


function getDefaultMedicationTimes(
    frequency
) {

    const value =
        String(
            frequency ||
            ""
        ).toLowerCase();

    if (
        value.includes("twice") ||
        value.includes("2 times") ||
        value.includes("two times") ||
        value.includes("bid")
    ) {

        return [
            "09:00",
            "21:00"
        ];

    }

    if (
        value.includes("three") ||
        value.includes("3 times") ||
        value.includes("tid")
    ) {

        return [
            "08:00",
            "14:00",
            "20:00"
        ];

    }

    if (
        value.includes("four") ||
        value.includes("4 times") ||
        value.includes("qid")
    ) {

        return [
            "06:00",
            "12:00",
            "18:00",
            "00:00"
        ];

    }

    if (
        value.includes("every 8") ||
        value.includes("q8h")
    ) {

        return [
            "06:00",
            "14:00",
            "22:00"
        ];

    }

    if (
        value.includes("every 12") ||
        value.includes("q12h")
    ) {

        return [
            "09:00",
            "21:00"
        ];

    }

    return [
        "09:00"
    ];

}


function parsePrescriptionLine(
    line
) {

    const cleanedLine =
        String(
            line ||
            ""
        ).trim();

    if (!cleanedLine) {
        return null;
    }

    let medicationPart =
        cleanedLine;

    let instructionPart =
        "";

    const separators = [
        " - ",
        " – ",
        " — ",
        ":"
    ];

    for (
        const separator
        of separators
    ) {

        const index =
            cleanedLine.indexOf(
                separator
            );

        if (
            index > 0
        ) {

            medicationPart =
                cleanedLine
                    .slice(
                        0,
                        index
                    )
                    .trim();

            instructionPart =
                cleanedLine
                    .slice(
                        index +
                        separator.length
                    )
                    .trim();

            break;

        }

    }

    if (!instructionPart) {

        instructionPart =
            "once daily";

    }

    const dosageMatch =
        medicationPart.match(
            /\b\d+(?:\.\d+)?\s*(?:mg|g|mcg|ml|mL|mg\/ml|%)\b/i
        );

    const dosage =
        dosageMatch
            ? dosageMatch[0]
            : null;

    const reminderTimes =
        extractTimesFromText(
            instructionPart
        );

    return {

        medication_name:
            medicationPart,

        dosage:
            dosage,

        frequency:
            instructionPart,

        reminderTimes:
            reminderTimes.length > 0
                ? reminderTimes
                : getDefaultMedicationTimes(
                    instructionPart
                )

    };

}


// =====================================================
// CREATE MEDICATION REMINDERS
// =====================================================

async function createMedicationReminders(
    appointmentId,
    patientId,
    prescription
) {

    if (!prescription) {
        return;
    }

    const lines =
        String(
            prescription
        )
            .split(
                /\r?\n/
            )
            .map(
                line =>
                    line
                        .replace(
                            /^\s*[-*•]\s*/,
                            ""
                        )
                        .trim()
            )
            .filter(
                line =>
                    line.length >
                    0
            );

    if (
        lines.length ===
        0
    ) {

        return;

    }

    const today =
        new Date()
            .toISOString()
            .slice(
                0,
                10
            );

    for (
        const line
        of lines
    ) {

        const medication =
            parsePrescriptionLine(
                line
            );

        if (!medication) {
            continue;
        }

        await runQuery(
            `
            DELETE FROM medication_reminders

            WHERE appointment_id = ?

            AND medication_name = ?
            `,
            [
                appointmentId,
                medication.medication_name
            ]
        );

        await runQuery(
            `
            DELETE FROM medications

            WHERE appointment_id = ?

            AND medication_name = ?
            `,
            [
                appointmentId,
                medication.medication_name
            ]
        );

        await runQuery(
            `
            INSERT INTO medications
            (
                appointment_id,
                patient_id,
                medication_name,
                dosage,
                frequency,
                start_date,
                end_date,
                reminder_time
            )

            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `,
            [
                appointmentId,
                patientId,
                medication.medication_name,
                medication.dosage,
                medication.frequency,
                today,
                null,
                medication.reminderTimes[0]
            ]
        );

        for (
            const reminderTime
            of medication.reminderTimes
        ) {

            await runQuery(
                `
                INSERT INTO medication_reminders
                (
                    appointment_id,
                    patient_id,
                    medication_name,
                    dosage,
                    frequency,
                    reminder_time,
                    active,
                    last_sent_at
                )

                VALUES (?, ?, ?, ?, ?, ?, 1, NULL)
                `,
                [
                    appointmentId,
                    patientId,
                    medication.medication_name,
                    medication.dosage,
                    medication.frequency,
                    reminderTime
                ]
            );

        }

        console.log(
            "Medication reminders created:",
            medication.medication_name,
            medication.reminderTimes
        );

    }

}


// =====================================================
// BOOK APPOINTMENT
// =====================================================

app.post(
    "/appointments",
    async (req, res) => {

        const {
            patient_id,
            doctor_id,
            appointment_date,
            appointment_time,
            symptoms
        } = req.body;

        if (
            !patient_id ||
            !doctor_id ||
            !appointment_date ||
            !appointment_time ||
            !symptoms
        ) {

            return res.status(400).json({

                error:
                    "All appointment fields are required"

            });

        }

        try {

            const leave =
                await runQuery(
                    `
                    SELECT
                        id

                    FROM doctor_leave

                    WHERE doctor_id = ?

                    AND leave_date = ?

                    LIMIT 1
                    `,
                    [
                        doctor_id,
                        appointment_date
                    ]
                );

            if (
                leave.length >
                0
            ) {

                return res.status(409).json({

                    error:
                        "Doctor is on leave on this date."

                });

            }

            const existing =
                await runQuery(
                    `
                    SELECT
                        id

                    FROM appointments

                    WHERE doctor_id = ?

                    AND appointment_date = ?

                    AND appointment_time = ?

                    AND status IN
                    (
                        'pending',
                        'accepted',
                        'confirmed'
                    )

                    LIMIT 1
                    `,
                    [
                        doctor_id,
                        appointment_date,
                        appointment_time
                    ]
                );

            if (
                existing.length >
                0
            ) {

                return res.status(409).json({

                    error:
                        "This appointment slot is already booked."

                });

            }

            const result =
                await runQuery(
                    `
                    INSERT INTO appointments
                    (
                        patient_id,
                        doctor_id,
                        appointment_date,
                        appointment_time,
                        symptoms,
                        status
                    )

                    VALUES
                    (?, ?, ?, ?, ?, 'pending')
                    `,
                    [
                        patient_id,
                        doctor_id,
                        appointment_date,
                        appointment_time,
                        symptoms
                    ]
                );

            const appointmentId =
                result.insertId;

            console.log(
                "Appointment created:",
                appointmentId
            );

            const aiResult =
                await generateAISymptomSummary(
                    symptoms
                );

            if (aiResult) {

                const aiText = `
Chief Complaint:
${aiResult.chief_complaint}

Urgency:
${aiResult.urgency}

Suggested Questions:
1. ${aiResult.suggested_questions[0]}
2. ${aiResult.suggested_questions[1]}
3. ${aiResult.suggested_questions[2]}
                `.trim();

                await runQuery(
                    `
                    UPDATE appointments

                    SET
                        ai_summary = ?,
                        ai_symptom_summary = ?,
                        urgency = ?

                    WHERE id = ?
                    `,
                    [
                        aiText,
                        aiText,
                        aiResult.urgency,
                        appointmentId
                    ]
                );

            }

            const infoRows =
                await runQuery(
                    `
                    SELECT

                        p.name AS patient_name,
                        p.email AS patient_email,

                        d.name AS doctor_name,
                        d.email AS doctor_email

                    FROM appointments a

                    JOIN users p
                        ON a.patient_id = p.id

                    JOIN users d
                        ON a.doctor_id = d.id

                    WHERE a.id = ?

                    LIMIT 1
                    `,
                    [
                        appointmentId
                    ]
                );

            if (
                infoRows.length ===
                0
            ) {

                return res.status(201).json({

                    message:
                        "Appointment booked successfully",

                    appointmentId:
                        appointmentId,

                    aiSummary:
                        aiResult || null

                });

            }

            const info =
                infoRows[0];

            await sendEmail({

                to:
                    info.patient_email,

                subject:
                    "Appointment Booking Confirmation",

                text: `
Hello ${info.patient_name},

Your appointment has been booked successfully.

Doctor:
Dr. ${info.doctor_name}

Date:
${appointment_date}

Time:
${appointment_time}

Symptoms:
${symptoms}

Thank you.
                `.trim()

            });

            await sendEmail({

                to:
                    info.doctor_email,

                subject:
                    "New Patient Appointment",

                text: `
Hello Dr. ${info.doctor_name},

A new patient appointment has been booked.

Patient:
${info.patient_name}

Date:
${appointment_date}

Time:
${appointment_time}

Symptoms:
${symptoms}

Please log in to the Healthcare Appointment Manager
to review the appointment.
                `.trim()

            });

            const calendarResult =
                await createGoogleCalendarEvent(
                    req,
                    appointmentId
                );

            return res.status(201).json({

                message:
                    "Appointment booked successfully",

                appointmentId:
                    appointmentId,

                aiSummary:
                    aiResult || null,

                calendarCreated:
                    calendarResult.success,

                calendarError:
                    calendarResult.success
                        ? null
                        : calendarResult.error

            });

        } catch (error) {

            console.error(
                "Appointment booking error:",
                error.message
            );

            return res.status(500).json({

                error:
                    error.message ||
                    "Appointment booking failed"

            });

        }

    }
);


// =====================================================
// PATIENT APPOINTMENTS
// =====================================================

app.get(
    "/appointments/patient/:patientId",
    async (req, res) => {

        const patientId =
            Number(
                req.params.patientId
            );

        if (
            !Number.isInteger(
                patientId
            ) ||
            patientId <= 0
        ) {

            return res.status(400).json({

                error:
                    "Invalid patient ID"

            });

        }

        try {

            const results =
                await runQuery(
                    `
                    SELECT

                        a.*,

                        d.name AS doctor_name,
                        d.email AS doctor_email

                    FROM appointments a

                    JOIN users d
                        ON a.doctor_id = d.id

                    WHERE a.patient_id = ?

                    ORDER BY
                        a.appointment_date DESC,
                        a.appointment_time DESC,
                        a.id DESC
                    `,
                    [
                        patientId
                    ]
                );

            return res.json(
                results
            );

        } catch (error) {

            return res.status(500).json({

                error:
                    error.message

            });

        }

    }
);


// =====================================================
// DOCTOR APPOINTMENTS
// =====================================================

app.get(
    "/appointments/doctor/:doctorId",
    async (req, res) => {

        const doctorId =
            Number(
                req.params.doctorId
            );

        if (
            !Number.isInteger(
                doctorId
            ) ||
            doctorId <= 0
        ) {

            return res.status(400).json({

                error:
                    "Invalid doctor ID"

            });

        }

        try {

            const results =
                await runQuery(
                    `
                    SELECT

                        a.*,

                        p.name AS patient_name,
                        p.email AS patient_email

                    FROM appointments a

                    JOIN users p
                        ON a.patient_id = p.id

                    WHERE a.doctor_id = ?

                    ORDER BY
                        a.appointment_date DESC,
                        a.appointment_time DESC,
                        a.id DESC
                    `,
                    [
                        doctorId
                    ]
                );

            return res.json(
                results
            );

        } catch (error) {

            return res.status(500).json({

                error:
                    error.message

            });

        }

    }
);


// =====================================================
// ALL APPOINTMENTS - ADMIN
// =====================================================

app.get(
    "/appointments/all",
    async (req, res) => {

        try {

            const results =
                await runQuery(
                    `
                    SELECT

                        a.id,

                        a.patient_id,
                        a.doctor_id,

                        a.appointment_date,
                        a.appointment_time,

                        a.symptoms,
                        a.status,

                        a.ai_summary,
                        a.ai_symptom_summary,
                        a.urgency,

                        a.doctor_notes,
                        a.prescription,
                        a.visit_summary,

                        p.name AS patient_name,
                        p.email AS patient_email,

                        d.name AS doctor_name,
                        d.email AS doctor_email

                    FROM appointments a

                    JOIN users p
                        ON a.patient_id = p.id

                    JOIN users d
                        ON a.doctor_id = d.id

                    ORDER BY
                        a.appointment_date DESC,
                        a.appointment_time DESC,
                        a.id DESC
                    `
                );

            return res.json(
                results
            );

        } catch (error) {

            console.error(
                "Admin appointments error:",
                error.message
            );

            return res.status(500).json({

                error:
                    error.message ||
                    "Unable to load all appointments."

            });

        }

    }
);


// =====================================================
// ACCEPT APPOINTMENT
// =====================================================

app.put(
    "/appointments/:id/accept",
    async (req, res) => {

        const id =
            Number(
                req.params.id
            );

        if (
            !Number.isInteger(id) ||
            id <= 0
        ) {

            return res.status(400).json({

                error:
                    "Invalid appointment ID"

            });

        }

        try {

            const result =
                await runQuery(
                    `
                    UPDATE appointments

                    SET status = 'accepted'

                    WHERE id = ?

                    AND status = 'pending'
                    `,
                    [
                        id
                    ]
                );

            if (
                result.affectedRows ===
                0
            ) {

                return res.status(400).json({

                    error:
                        "Appointment cannot be accepted"

                });

            }

            const rows =
                await runQuery(
                    `
                    SELECT

                        p.name AS patient_name,
                        p.email AS patient_email,

                        d.name AS doctor_name

                    FROM appointments a

                    JOIN users p
                        ON a.patient_id = p.id

                    JOIN users d
                        ON a.doctor_id = d.id

                    WHERE a.id = ?

                    LIMIT 1
                    `,
                    [
                        id
                    ]
                );

            if (
                rows.length >
                0
            ) {

                await sendEmail({

                    to:
                        rows[0].patient_email,

                    subject:
                        "Appointment Accepted",

                    text: `
Hello ${rows[0].patient_name},

Your appointment with Dr. ${rows[0].doctor_name}
has been accepted.

Thank you.
                    `.trim()

                });

            }

            return res.json({

                message:
                    "Appointment accepted successfully"

            });

        } catch (error) {

            return res.status(500).json({

                error:
                    error.message

            });

        }

    }
);


// =====================================================
// REJECT APPOINTMENT
// =====================================================

app.put(
    "/appointments/:id/reject",
    async (req, res) => {

        const id =
            Number(
                req.params.id
            );

        if (
            !Number.isInteger(id) ||
            id <= 0
        ) {

            return res.status(400).json({

                error:
                    "Invalid appointment ID"

            });

        }

        try {

            const result =
                await runQuery(
                    `
                    UPDATE appointments

                    SET status = 'rejected'

                    WHERE id = ?

                    AND status = 'pending'
                    `,
                    [
                        id
                    ]
                );

            if (
                result.affectedRows ===
                0
            ) {

                return res.status(400).json({

                    error:
                        "Appointment cannot be rejected"

                });

            }

            const rows =
                await runQuery(
                    `
                    SELECT

                        p.name AS patient_name,
                        p.email AS patient_email,

                        d.name AS doctor_name

                    FROM appointments a

                    JOIN users p
                        ON a.patient_id = p.id

                    JOIN users d
                        ON a.doctor_id = d.id

                    WHERE a.id = ?

                    LIMIT 1
                    `,
                    [
                        id
                    ]
                );

            if (
                rows.length >
                0
            ) {

                await sendEmail({

                    to:
                        rows[0].patient_email,

                    subject:
                        "Appointment Rejected",

                    text: `
Hello ${rows[0].patient_name},

Your appointment with Dr. ${rows[0].doctor_name}
has been rejected.

Please book another available appointment.

Thank you.
                    `.trim()

                });

            }

            return res.json({

                message:
                    "Appointment rejected successfully"

            });

        } catch (error) {

            return res.status(500).json({

                error:
                    error.message

            });

        }

    }
);


// =====================================================
// RESCHEDULE APPOINTMENT
// =====================================================

app.put(
    "/appointments/:id/reschedule",
    async (req, res) => {

        const id =
            Number(
                req.params.id
            );

        const {
            appointment_date,
            appointment_time
        } = req.body;

        if (
            !Number.isInteger(id) ||
            id <= 0
        ) {

            return res.status(400).json({

                error:
                    "Invalid appointment ID"

            });

        }

        if (
            !appointment_date ||
            !/^\d{4}-\d{2}-\d{2}$/.test(
                String(appointment_date)
            )
        ) {

            return res.status(400).json({

                error:
                    "Appointment date must be in YYYY-MM-DD format"

            });

        }

        if (!appointment_time) {

            return res.status(400).json({

                error:
                    "Appointment time is required"

            });

        }

        if (
            !/^\d{2}:\d{2}$/.test(
                String(appointment_time)
            ) &&
            !/^\d{2}:\d{2}:\d{2}$/.test(
                String(appointment_time)
            )
        ) {

            return res.status(400).json({

                error:
                    "Appointment time must be in HH:MM or HH:MM:SS format"

            });

        }

        const normalizedTime =
            String(
                appointment_time
            ).length === 5
                ? `${appointment_time}:00`
                : String(
                    appointment_time
                );

        try {

            const currentRows =
                await runQuery(
                    `
                    SELECT

                        id,
                        patient_id,
                        doctor_id,
                        appointment_date,
                        appointment_time,
                        status

                    FROM appointments

                    WHERE id = ?

                    LIMIT 1
                    `,
                    [
                        id
                    ]
                );

            if (
                currentRows.length ===
                0
            ) {

                return res.status(404).json({

                    error:
                        "Appointment not found"

                });

            }

            const currentAppointment =
                currentRows[0];

            const allowedStatuses = [
                "pending",
                "accepted",
                "confirmed"
            ];

            if (
                !allowedStatuses.includes(
                    currentAppointment.status
                )
            ) {

                return res.status(400).json({

                    error:
                        "This appointment cannot be rescheduled"

                });

            }

            const doctorRows =
                await runQuery(
                    `
                    SELECT

                        working_start,
                        working_end,
                        slot_duration

                    FROM doctor_profiles

                    WHERE doctor_id = ?

                    LIMIT 1
                    `,
                    [
                        currentAppointment.doctor_id
                    ]
                );

            if (
                doctorRows.length ===
                0
            ) {

                return res.status(404).json({

                    error:
                        "Doctor profile not found"

                });

            }

            const doctor =
                doctorRows[0];

            const requestedMinutes =
                timeToMinutes(
                    normalizedTime
                );

            const workingStart =
                timeToMinutes(
                    doctor.working_start
                );

            const workingEnd =
                timeToMinutes(
                    doctor.working_end
                );

            const duration =
                Number(
                    doctor.slot_duration ||
                    30
                );

            if (
                !Number.isFinite(
                    requestedMinutes
                )
            ) {

                return res.status(400).json({

                    error:
                        "Invalid appointment time"

                });

            }

            if (
                requestedMinutes <
                workingStart
            ) {

                return res.status(409).json({

                    error:
                        "The selected time is before the doctor's working hours."

                });

            }

            if (
                requestedMinutes +
                duration >
                workingEnd
            ) {

                return res.status(409).json({

                    error:
                        "The selected time is outside the doctor's working hours."

                });

            }

            const leaveRows =
                await runQuery(
                    `
                    SELECT
                        id

                    FROM doctor_leave

                    WHERE doctor_id = ?

                    AND leave_date = ?

                    LIMIT 1
                    `,
                    [
                        currentAppointment.doctor_id,
                        appointment_date
                    ]
                );

            if (
                leaveRows.length >
                0
            ) {

                return res.status(409).json({

                    error:
                        "Doctor is on leave on the selected date."

                });

            }

            const existingRows =
                await runQuery(
                    `
                    SELECT
                        id

                    FROM appointments

                    WHERE doctor_id = ?

                    AND appointment_date = ?

                    AND appointment_time = ?

                    AND id <> ?

                    AND status IN
                    (
                        'pending',
                        'accepted',
                        'confirmed'
                    )

                    LIMIT 1
                    `,
                    [
                        currentAppointment.doctor_id,
                        appointment_date,
                        normalizedTime,
                        id
                    ]
                );

            if (
                existingRows.length >
                0
            ) {

                return res.status(409).json({

                    error:
                        "The selected appointment slot is already booked."

                });

            }

            const oldDate =
                formatDateOnly(
                    currentAppointment.appointment_date
                );

            const oldTime =
                String(
                    currentAppointment.appointment_time
                ).slice(
                    0,
                    8
                );

            const updateResult =
                await runQuery(
                    `
                    UPDATE appointments

                    SET
                        appointment_date = ?,
                        appointment_time = ?

                    WHERE id = ?

                    AND status IN
                    (
                        'pending',
                        'accepted',
                        'confirmed'
                    )
                    `,
                    [
                        appointment_date,
                        normalizedTime,
                        id
                    ]
                );

            if (
                updateResult.affectedRows ===
                0
            ) {

                return res.status(400).json({

                    error:
                        "Appointment could not be updated"

                });

            }

            let calendarUpdated =
                false;

            let calendarCreated =
                false;

            let calendarError =
                null;

            const auth =
                getGoogleCalendarClientFromSession(
                    req
                );

            if (auth) {

                try {

                    const calendarRows =
                        await runQuery(
                            `
                            SELECT

                                id,
                                google_event_id

                            FROM calendar_events

                            WHERE appointment_id = ?

                            ORDER BY id DESC

                            LIMIT 1
                            `,
                            [
                                id
                            ]
                        );

                    if (
                        calendarRows.length >
                        0
                    ) {

                        const appointmentRows =
                            await runQuery(
                                `
                                SELECT

                                    a.id,
                                    a.appointment_date,
                                    a.appointment_time,
                                    a.symptoms,

                                    p.name AS patient_name,
                                    p.email AS patient_email,

                                    d.name AS doctor_name,
                                    d.email AS doctor_email,

                                    dp.slot_duration

                                FROM appointments a

                                JOIN users p
                                    ON a.patient_id = p.id

                                JOIN users d
                                    ON a.doctor_id = d.id

                                LEFT JOIN doctor_profiles dp
                                    ON dp.doctor_id = a.doctor_id

                                WHERE a.id = ?

                                LIMIT 1
                                `,
                                [
                                    id
                                ]
                            );

                        if (
                            appointmentRows.length >
                            0
                        ) {

                            const appointment =
                                appointmentRows[0];

                            const startDate =
                                parseAppointmentDateTime(
                                    appointment.appointment_date,
                                    appointment.appointment_time
                                );

                            if (
                                Number.isNaN(
                                    startDate.getTime()
                                )
                            ) {

                                throw new Error(
                                    "Invalid appointment date/time for Google Calendar."
                                );

                            }

                            const eventDuration =
                                Number(
                                    appointment.slot_duration ||
                                    30
                                );

                            const endDate =
                                new Date(
                                    startDate.getTime() +
                                    eventDuration *
                                    60 *
                                    1000
                                );

                            const calendar =
                                google.calendar({

                                    version:
                                        "v3",

                                    auth:
                                        auth

                                });

                            await calendar.events.update({

                                calendarId:
                                    "primary",

                                eventId:
                                    calendarRows[0]
                                        .google_event_id,

                                requestBody: {

                                    summary:
                                        `Healthcare Appointment - Dr. ${appointment.doctor_name}`,

                                    description:
                                        `
Healthcare Appointment & Follow-up Manager

Patient:
${appointment.patient_name}

Symptoms:
${appointment.symptoms || "Not provided"}

Doctor:
Dr. ${appointment.doctor_name}
                                        `.trim(),

                                    start: {

                                        dateTime:
                                            startDate.toISOString(),

                                        timeZone:
                                            "Asia/Kolkata"

                                    },

                                    end: {

                                        dateTime:
                                            endDate.toISOString(),

                                        timeZone:
                                            "Asia/Kolkata"

                                    },

                                    attendees: [

                                        {
                                            email:
                                                appointment.patient_email
                                        },

                                        {
                                            email:
                                                appointment.doctor_email
                                        }

                                    ]

                                },

                                sendUpdates:
                                    "all"

                            });

                            calendarUpdated =
                                true;

                            console.log(
                                "Google Calendar event updated:",
                                calendarRows[0]
                                    .google_event_id
                            );

                        }

                    } else {

                        const createResult =
                            await createGoogleCalendarEvent(
                                req,
                                id
                            );

                        if (
                            createResult.success
                        ) {

                            calendarUpdated =
                                true;

                            calendarCreated =
                                true;

                        } else {

                            calendarError =
                                createResult.error;

                        }

                    }

                } catch (calendarErrorObject) {

                    calendarError =
                        calendarErrorObject.message;

                    console.error(
                        "Google Calendar reschedule update failed:",
                        calendarErrorObject.message
                    );

                }

            } else {

                calendarError =
                    "Google Calendar is not connected in this browser session.";

            }

            const peopleRows =
                await runQuery(
                    `
                    SELECT

                        p.name AS patient_name,
                        p.email AS patient_email,

                        d.name AS doctor_name,
                        d.email AS doctor_email

                    FROM appointments a

                    JOIN users p
                        ON a.patient_id = p.id

                    JOIN users d
                        ON a.doctor_id = d.id

                    WHERE a.id = ?

                    LIMIT 1
                    `,
                    [
                        id
                    ]
                );

            if (
                peopleRows.length >
                0
            ) {

                const info =
                    peopleRows[0];

                await sendEmail({

                    to:
                        info.patient_email,

                    subject:
                        "Appointment Rescheduled",

                    text: `
Hello ${info.patient_name},

Your appointment with Dr. ${info.doctor_name}
has been rescheduled.

Previous Date:
${oldDate}

Previous Time:
${oldTime}

New Date:
${appointment_date}

New Time:
${normalizedTime}

${
    calendarUpdated
        ? "Your Google Calendar event was also updated successfully."
        : "Your appointment was updated, but Google Calendar could not be updated."
}

Please log in to the Healthcare Appointment Manager
for your latest appointment details.

Thank you.
                    `.trim()

                });

                await sendEmail({

                    to:
                        info.doctor_email,

                    subject:
                        "Appointment Rescheduled",

                    text: `
Hello Dr. ${info.doctor_name},

The appointment with ${info.patient_name}
has been rescheduled.

Previous Date:
${oldDate}

Previous Time:
${oldTime}

New Date:
${appointment_date}

New Time:
${normalizedTime}

Please log in to the Healthcare Appointment Manager
for the updated appointment details.

Thank you.
                    `.trim()

                });

            }

            return res.json({

                message:
                    "Appointment rescheduled successfully",

                appointment: {

                    id:
                        id,

                    appointment_date:
                        appointment_date,

                    appointment_time:
                        normalizedTime

                },

                calendarUpdated:
                    calendarUpdated,

                calendarCreated:
                    calendarCreated,

                calendarError:
                    calendarUpdated
                        ? null
                        : calendarError

            });

        } catch (error) {

            console.error(
                "Appointment reschedule failed:",
                error.message
            );

            return res.status(500).json({

                error:
                    error.message ||
                    "Appointment rescheduling failed"

            });

        }

    }
);


// =====================================================
// COMPLETE APPOINTMENT
// =====================================================

app.put(
    "/appointments/:id/complete",
    async (req, res) => {

        const id =
            Number(
                req.params.id
            );

        const {
            doctor_notes,
            prescription
        } = req.body;

        if (
            !Number.isInteger(id) ||
            id <= 0
        ) {

            return res.status(400).json({

                error:
                    "Invalid appointment ID"

            });

        }

        if (
            !doctor_notes &&
            !prescription
        ) {

            return res.status(400).json({

                error:
                    "Doctor notes or prescription is required"

            });

        }

        try {

            const fallbackSummary = `
Patient was evaluated based on the reported symptoms.

Doctor Notes:
${doctor_notes || "No additional notes provided."}

Prescription:
${prescription || "No prescription provided."}

The patient should follow the doctor's recommendations
and attend the recommended follow-up.
            `.trim();

            const aiResult =
                await generateAIPostVisitSummary(
                    doctor_notes,
                    prescription
                );

            const visitSummary =
                aiResult
                    ? `
Patient-Friendly Visit Summary:
${aiResult.summary}

Medication Schedule:
${aiResult.medication_schedule}

Follow-Up Steps:
${aiResult.follow_up_steps}
                    `.trim()
                    : fallbackSummary;

            const result =
                await runQuery(
                    `
                    UPDATE appointments

                    SET
                        status = 'completed',
                        doctor_notes = ?,
                        prescription = ?,
                        visit_summary = ?

                    WHERE id = ?

                    AND status = 'accepted'
                    `,
                    [
                        doctor_notes ||
                            null,

                        prescription ||
                            null,

                        visitSummary,

                        id
                    ]
                );

            if (
                result.affectedRows ===
                0
            ) {

                return res.status(400).json({

                    error:
                        "Appointment cannot be completed"

                });

            }

            if (
                prescription &&
                prescription.trim()
            ) {

                const appointmentInfo =
                    await runQuery(
                        `
                        SELECT
                            patient_id

                        FROM appointments

                        WHERE id = ?

                        LIMIT 1
                        `,
                        [
                            id
                        ]
                    );

                if (
                    appointmentInfo.length >
                    0
                ) {

                    try {

                        await createMedicationReminders(

                            id,

                            appointmentInfo[0]
                                .patient_id,

                            prescription

                        );

                    } catch (medicationError) {

                        console.error(
                            "Medication reminder creation failed:",
                            medicationError.message
                        );

                    }

                }

            }

            const rows =
                await runQuery(
                    `
                    SELECT

                        p.name AS patient_name,
                        p.email AS patient_email,

                        d.name AS doctor_name

                    FROM appointments a

                    JOIN users p
                        ON a.patient_id = p.id

                    JOIN users d
                        ON a.doctor_id = d.id

                    WHERE a.id = ?

                    LIMIT 1
                    `,
                    [
                        id
                    ]
                );

            if (
                rows.length >
                0
            ) {

                await sendEmail({

                    to:
                        rows[0].patient_email,

                    subject:
                        "Visit Completed - Healthcare Manager",

                    text: `
Hello ${rows[0].patient_name},

Your appointment with Dr. ${rows[0].doctor_name}
has been completed.

Your patient-friendly visit summary is now available
in the Healthcare Appointment Manager.

Thank you.
                    `.trim()

                });

            }

            return res.json({

                message:
                    "Appointment completed successfully",

                aiGenerated:
                    !!aiResult,

                medicationRemindersCreated:
                    !!(
                        prescription &&
                        prescription.trim()
                    ),

                visitSummary:
                    visitSummary

            });

        } catch (error) {

            console.error(
                "Complete appointment error:",
                error.message
            );

            return res.status(500).json({

                error:
                    error.message

            });

        }

    }
);


// =====================================================
// CANCEL APPOINTMENT
// =====================================================

app.put(
    "/appointments/:id/cancel",
    async (req, res) => {

        const id =
            Number(
                req.params.id
            );

        if (
            !Number.isInteger(id) ||
            id <= 0
        ) {

            return res.status(400).json({

                error:
                    "Invalid appointment ID"

            });

        }

        try {

            const result =
                await runQuery(
                    `
                    UPDATE appointments

                    SET status = 'cancelled'

                    WHERE id = ?

                    AND status IN
                    (
                        'pending',
                        'accepted',
                        'confirmed'
                    )
                    `,
                    [
                        id
                    ]
                );

            if (
                result.affectedRows ===
                0
            ) {

                return res.status(400).json({

                    error:
                        "Appointment cannot be cancelled"

                });

            }

            const calendarDeleted =
                await deleteGoogleCalendarEvents(
                    req,
                    id
                );

            const rows =
                await runQuery(
                    `
                    SELECT

                        p.name AS patient_name,
                        p.email AS patient_email,

                        d.name AS doctor_name,
                        d.email AS doctor_email

                    FROM appointments a

                    JOIN users p
                        ON a.patient_id = p.id

                    JOIN users d
                        ON a.doctor_id = d.id

                    WHERE a.id = ?

                    LIMIT 1
                    `,
                    [
                        id
                    ]
                );

            if (
                rows.length >
                0
            ) {

                await sendEmail({

                    to:
                        rows[0].patient_email,

                    subject:
                        "Appointment Cancelled",

                    text: `
Hello ${rows[0].patient_name},

Your appointment with Dr. ${rows[0].doctor_name}
has been cancelled.

Thank you.
                    `.trim()

                });

                await sendEmail({

                    to:
                        rows[0].doctor_email,

                    subject:
                        "Appointment Cancelled",

                    text: `
The appointment with patient
${rows[0].patient_name}
has been cancelled.

Thank you.
                    `.trim()

                });

            }

            return res.json({

                message:
                    "Appointment cancelled successfully",

                calendarDeleted:
                    calendarDeleted

            });

        } catch (error) {

            console.error(
                "Cancel appointment error:",
                error.message
            );

            return res.status(500).json({

                error:
                    error.message

            });

        }

    }
);


// =====================================================
// PATIENT VISIT SUMMARIES
// =====================================================

app.get(
    "/visit-summaries/:patientId",
    async (req, res) => {

        const patientId =
            Number(
                req.params.patientId
            );

        if (
            !Number.isInteger(
                patientId
            ) ||
            patientId <= 0
        ) {

            return res.status(400).json({

                error:
                    "Invalid patient ID"

            });

        }

        try {

            const results =
                await runQuery(
                    `
                    SELECT

                        a.id,
                        a.appointment_date,
                        a.appointment_time,
                        a.symptoms,
                        a.visit_summary,
                        a.prescription,

                        d.name AS doctor_name

                    FROM appointments a

                    JOIN users d
                        ON a.doctor_id = d.id

                    WHERE a.patient_id = ?

                    AND a.status = 'completed'

                    ORDER BY
                        a.appointment_date DESC,
                        a.appointment_time DESC,
                        a.id DESC
                    `,
                    [
                        patientId
                    ]
                );

            return res.json(
                results
            );

        } catch (error) {

            return res.status(500).json({

                error:
                    error.message

            });

        }

    }
);


// =====================================================
// PATIENT MEDICATIONS
// =====================================================

app.get(
    "/medications/patient/:patientId",
    async (req, res) => {

        const patientId =
            Number(
                req.params.patientId
            );

        if (
            !Number.isInteger(
                patientId
            ) ||
            patientId <= 0
        ) {

            return res.status(400).json({

                error:
                    "Invalid patient ID"

            });

        }

        try {

            const medications =
                await runQuery(
                    `
                    SELECT

                        m.id,
                        m.appointment_id,
                        m.patient_id,

                        m.medication_name,
                        m.dosage,
                        m.frequency,

                        DATE_FORMAT(
                            m.start_date,
                            '%Y-%m-%d'
                        ) AS start_date,

                        DATE_FORMAT(
                            m.end_date,
                            '%Y-%m-%d'
                        ) AS end_date,

                        COALESCE(

                            GROUP_CONCAT(
                                DISTINCT
                                TIME_FORMAT(
                                    mr.reminder_time,
                                    '%H:%i'
                                )
                                ORDER BY
                                    mr.reminder_time
                                SEPARATOR ', '
                            ),

                            TIME_FORMAT(
                                m.reminder_time,
                                '%H:%i'
                            )

                        ) AS reminder_time

                    FROM medications m

                    LEFT JOIN medication_reminders mr

                        ON mr.appointment_id =
                            m.appointment_id

                        AND mr.patient_id =
                            m.patient_id

                        AND mr.medication_name =
                            m.medication_name

                        AND mr.active = 1

                    WHERE m.patient_id = ?

                    GROUP BY

                        m.id,
                        m.appointment_id,
                        m.patient_id,
                        m.medication_name,
                        m.dosage,
                        m.frequency,
                        m.start_date,
                        m.end_date,
                        m.reminder_time

                    ORDER BY

                        m.start_date DESC,
                        m.id DESC
                    `,
                    [
                        patientId
                    ]
                );

            return res.json(
                medications
            );

        } catch (error) {

            console.error(
                "Patient medications error:",
                error.message
            );

            return res.status(500).json({

                error:
                    "Unable to load medications."

            });

        }

    }
);


// =====================================================
// APPOINTMENT REMINDER JOB
// =====================================================

async function sendAppointmentReminders() {

    const sql = `
        SELECT

            a.id,
            a.appointment_date,
            a.appointment_time,

            p.name AS patient_name,
            p.email AS patient_email,

            d.name AS doctor_name,
            d.email AS doctor_email

        FROM appointments a

        JOIN users p
            ON a.patient_id = p.id

        JOIN users d
            ON a.doctor_id = d.id

        WHERE a.status IN
        (
            'pending',
            'accepted',
            'confirmed'
        )

        AND TIMESTAMP(
            a.appointment_date,
            a.appointment_time
        ) BETWEEN

            DATE_ADD(
                NOW(),
                INTERVAL 23 HOUR
            )

            AND

            DATE_ADD(
                NOW(),
                INTERVAL 25 HOUR
            )
    `;

    db.query(
        sql,
        async (
            err,
            appointments
        ) => {

            if (err) {

                console.error(
                    "Reminder query failed:",
                    err.message
                );

                return;

            }

            for (
                const appointment
                of appointments
            ) {

                await sendReminderToRecipient(

                    appointment,

                    appointment.patient_email,

                    appointment.patient_name,

                    "patient"

                );

                await sendReminderToRecipient(

                    appointment,

                    appointment.doctor_email,

                    appointment.doctor_name,

                    "doctor"

                );

            }

        }
    );

}


// =====================================================
// SEND APPOINTMENT REMINDER
// =====================================================

async function sendReminderToRecipient(
    appointment,
    email,
    name,
    recipientType
) {

    if (!email) {
        return;
    }

    const notificationType =
        `appointment_reminder_${recipientType}`;

    try {

        const existing =
            await runQuery(
                `
                SELECT
                    id

                FROM notification_log

                WHERE appointment_id = ?

                AND recipient_email = ?

                AND notification_type = ?

                LIMIT 1
                `,
                [
                    appointment.id,
                    email,
                    notificationType
                ]
            );

        if (
            existing.length >
            0
        ) {

            return;

        }

        const result =
            await sendEmail({

                to:
                    email,

                subject:
                    "Healthcare Appointment Reminder",

                text: `
Hello ${name},

This is a reminder that you have an upcoming healthcare appointment.

Doctor:
Dr. ${appointment.doctor_name}

Date:
${appointment.appointment_date}

Time:
${appointment.appointment_time}

Please be ready for your appointment.

Thank you.
                `.trim()

            });

        if (!result.success) {

            console.log(
                "Reminder email failed. The next background run will retry it."
            );

            return;

        }

        await runQuery(
            `
            INSERT INTO notification_log
            (
                appointment_id,
                recipient_email,
                notification_type
            )

            VALUES (?, ?, ?)
            `,
            [
                appointment.id,
                email,
                notificationType
            ]
        );

    } catch (error) {

        if (
            error.code !==
            "ER_DUP_ENTRY"
        ) {

            console.error(
                "Appointment reminder error:",
                error.message
            );

        }

    }

}


// =====================================================
// START APPOINTMENT REMINDER JOB
// =====================================================

cron.schedule(
    "* * * * *",
    async () => {

        try {

            await sendAppointmentReminders();

        } catch (error) {

            console.error(
                "Appointment reminder job failed:",
                error.message
            );

        }

    },
    {
        name:
            "appointment-reminders",

        noOverlap:
            true

    }
);

console.log(
    "Appointment reminder background job started."
);


// =====================================================
// MEDICATION REMINDER JOB
// =====================================================

async function sendMedicationReminders() {

    const sql = `
        SELECT

            mr.id,
            mr.appointment_id,
            mr.patient_id,

            mr.medication_name,
            mr.dosage,
            mr.frequency,

            mr.reminder_time,
            mr.last_sent_at,

            m.start_date,
            m.end_date,

            u.name AS patient_name,
            u.email AS patient_email

        FROM medication_reminders mr

        JOIN users u
            ON mr.patient_id = u.id

        LEFT JOIN medications m

            ON m.appointment_id =
                mr.appointment_id

            AND m.patient_id =
                mr.patient_id

            AND m.medication_name =
                mr.medication_name

        WHERE mr.active = 1

        AND (
            m.start_date IS NULL
            OR CURDATE() >= m.start_date
        )

        AND (
            m.end_date IS NULL
            OR CURDATE() <= m.end_date
        )

        AND TIME(mr.reminder_time)
            <= CURTIME()

        AND (
            mr.last_sent_at IS NULL

            OR DATE(mr.last_sent_at) <
                CURDATE()
        )
    `;

    db.query(
        sql,
        async (
            err,
            reminders
        ) => {

            if (err) {

                console.error(
                    "Medication reminder query failed:",
                    err.message
                );

                return;

            }

            for (
                const reminder
                of reminders
            ) {

                const result =
                    await sendEmail({

                        to:
                            reminder.patient_email,

                        subject:
                            "Medication Reminder",

                        text: `
Hello ${reminder.patient_name},

This is your medication reminder.

Medication:
${reminder.medication_name}

Dosage:
${reminder.dosage || "As prescribed"}

Frequency:
${reminder.frequency}

Reminder Time:
${reminder.reminder_time}

Please follow your doctor's prescription and medication instructions.

Healthcare Appointment & Follow-up Manager
                        `.trim()

                    });

                if (!result.success) {

                    console.log(
                        "Medication reminder email failed. The next job run will retry it."
                    );

                    continue;

                }

                await runQuery(
                    `
                    UPDATE medication_reminders

                    SET last_sent_at = NOW()

                    WHERE id = ?
                    `,
                    [
                        reminder.id
                    ]
                );

                console.log(
                    "Medication reminder sent:",
                    reminder.medication_name,
                    reminder.patient_email
                );

            }

        }
    );

}


// =====================================================
// START MEDICATION REMINDER JOB
// =====================================================

cron.schedule(
    "* * * * *",
    async () => {

        try {

            await sendMedicationReminders();

        } catch (error) {

            console.error(
                "Medication reminder job failed:",
                error.message
            );

        }

    },
    {
        name:
            "medication-reminders",

        noOverlap:
            true

    }
);

console.log(
    "Medication reminder background job started."
);


// =====================================================
// SERVER START
// =====================================================

app.listen(
    5000,
    async () => {

        console.log(
            "Server running on http://localhost:5000"
        );

        await verifyEmailTransporter();

    }
);
