const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const bcrypt = require("bcrypt");
const OpenAI = require("openai");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static("public"));


// =====================================================
// OPENAI
// =====================================================

let openai = null;

if (process.env.OPENAI_API_KEY) {

    openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
    });

    console.log("OpenAI API key loaded successfully.");

} else {

    console.log("WARNING: OPENAI_API_KEY is not configured.");

}


// =====================================================
// MYSQL CONNECTION
// =====================================================

const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "Chitti@2005",
    database: "health"
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

    }

});


// =====================================================
// TEST
// =====================================================

app.get("/", (req, res) => {

    res.json({
        message: "Healthcare Manager Backend is running!"
    });

});


// =====================================================
// OPENAI TEST
// =====================================================

app.get("/test-openai", async (req, res) => {

    if (!openai) {

        return res.status(500).json({
            success: false,
            error: "OPENAI_API_KEY is not configured in .env"
        });

    }

    try {

        const response = await openai.responses.create({

            model: "gpt-5.6-luna",

            input:
                "Reply with exactly: OpenAI connection successful."

        });

        res.json({

            success: true,

            message:
                response.output_text

        });

    } catch (error) {

        console.error(
            "OpenAI test failed:"
        );

        console.error(
            error.message
        );

        res.status(500).json({

            success: false,

            error:
                error.message || "OpenAI request failed"

        });

    }

});


// =====================================================
// USERS
// =====================================================

app.get("/users", (req, res) => {

    const sql = `
        SELECT id, name, email, role
        FROM users
    `;

    db.query(sql, (err, results) => {

        if (err) {

            return res.status(500).json({
                error: err.message
            });

        }

        res.json(results);

    });

});


// =====================================================
// REGISTER
// =====================================================

app.post("/users", async (req, res) => {

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
            error: "All fields are required"
        });

    }

    try {

        const hashedPassword =
            await bcrypt.hash(password, 10);

        const sql = `
            INSERT INTO users
            (name, email, password, role)
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
                        error: err.message
                    });

                }

                res.status(201).json({

                    message:
                        "User created successfully",

                    userId:
                        result.insertId

                });

            }
        );

    } catch (error) {

        res.status(500).json({
            error:
                "Password encryption failed"
        });

    }

});


// =====================================================
// LOGIN
// =====================================================

app.post("/login", (req, res) => {

    const {
        email,
        password
    } = req.body;

    if (!email || !password) {

        return res.status(400).json({
            error:
                "Email and password are required"
        });

    }

    const sql = `
        SELECT *
        FROM users
        WHERE email = ?
    `;

    db.query(
        sql,
        [email],
        async (err, results) => {

            if (err) {

                return res.status(500).json({
                    error: err.message
                });

            }

            if (results.length === 0) {

                return res.status(401).json({
                    error:
                        "Invalid email or password"
                });

            }

            const user = results[0];

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

                res.json({

                    message:
                        "Login successful",

                    user: {

                        id: user.id,

                        name: user.name,

                        email: user.email,

                        role: user.role

                    }

                });

            } catch (error) {

                res.status(500).json({
                    error:
                        "Login failed"
                });

            }

        }
    );

});


// =====================================================
// GET ALL DOCTORS
// =====================================================

app.get("/doctors", (req, res) => {

    const sql = `
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
    `;

    db.query(sql, (err, results) => {

        if (err) {

            return res.status(500).json({
                error: err.message
            });

        }

        res.json(results);

    });

});


// =====================================================
// ADD DOCTOR
// =====================================================

app.post("/admin/doctors", async (req, res) => {

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

    try {

        const hashedPassword =
            await bcrypt.hash(password, 10);

        db.beginTransaction((transactionError) => {

            if (transactionError) {

                return res.status(500).json({
                    error:
                        transactionError.message
                });

            }

            const userSql = `
                INSERT INTO users
                (name, email, password, role)
                VALUES (?, ?, ?, 'doctor')
            `;

            db.query(
                userSql,
                [
                    name,
                    email,
                    hashedPassword
                ],
                (err, result) => {

                    if (err) {

                        return db.rollback(() => {

                            if (
                                err.code ===
                                "ER_DUP_ENTRY"
                            ) {

                                res.status(409).json({
                                    error:
                                        "Doctor email already exists"
                                });

                            } else {

                                res.status(500).json({
                                    error:
                                        err.message
                                });

                            }

                        });

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
                            slot_duration
                        ],
                        (profileError) => {

                            if (profileError) {

                                return db.rollback(() => {

                                    res.status(500).json({
                                        error:
                                            profileError.message
                                    });

                                });

                            }

                            db.commit(
                                (commitError) => {

                                    if (commitError) {

                                        return db.rollback(
                                            () => {

                                                res.status(
                                                    500
                                                ).json({
                                                    error:
                                                        commitError.message
                                                });

                                            }
                                        );

                                    }

                                    res.status(201).json({

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

        });

    } catch (error) {

        res.status(500).json({
            error:
                "Doctor creation failed"
        });

    }

});


// =====================================================
// ADD DOCTOR LEAVE
// =====================================================

app.post(
    "/doctors/:doctorId/leave",
    (req, res) => {

        const doctorId =
            req.params.doctorId;

        const {
            leave_date,
            reason
        } = req.body;

        if (!leave_date) {

            return res.status(400).json({
                error:
                    "Leave date is required"
            });

        }

        const sql = `
            INSERT INTO doctor_leave
            (doctor_id, leave_date, reason)
            VALUES (?, ?, ?)
        `;

        db.query(
            sql,
            [
                doctorId,
                leave_date,
                reason || null
            ],
            (err) => {

                if (err) {

                    if (
                        err.code ===
                        "ER_DUP_ENTRY"
                    ) {

                        return res.status(409).json({
                            error:
                                "Doctor is already on leave on this date"
                        });

                    }

                    return res.status(500).json({
                        error: err.message
                    });

                }

                const appointmentSql = `
                    SELECT
                        a.id,
                        a.patient_id,
                        a.appointment_date,
                        a.appointment_time,
                        u.email,
                        u.name
                    FROM appointments a
                    JOIN users u
                        ON a.patient_id = u.id
                    WHERE a.doctor_id = ?
                    AND a.appointment_date = ?
                    AND a.status IN
                    (
                        'pending',
                        'accepted',
                        'confirmed'
                    )
                `;

                db.query(
                    appointmentSql,
                    [
                        doctorId,
                        leave_date
                    ],
                    (
                        appointmentError,
                        appointments
                    ) => {

                        if (appointmentError) {

                            return res.status(500).json({
                                error:
                                    appointmentError.message
                            });

                        }

                        if (
                            appointments.length === 0
                        ) {

                            return res.json({

                                message:
                                    "Leave added successfully. No affected appointments.",

                                affectedAppointments:
                                    0

                            });

                        }

                        let completed = 0;

                        appointments.forEach(
                            (appointment) => {

                                const updateSql = `
                                    UPDATE appointments
                                    SET status = 'cancelled'
                                    WHERE id = ?
                                `;

                                db.query(
                                    updateSql,
                                    [appointment.id],
                                    () => {

                                        completed++;

                                        if (
                                            completed ===
                                            appointments.length
                                        ) {

                                            res.json({

                                                message:
                                                    "Leave added successfully and affected appointments were cancelled.",

                                                affectedAppointments:
                                                    appointments.length

                                            });

                                        }

                                    }
                                );

                            }
                        );

                    }
                );

            }
        );

    }
);


// =====================================================
// GET DOCTOR LEAVE
// =====================================================

app.get(
    "/doctors/:doctorId/leave",
    (req, res) => {

        const doctorId =
            req.params.doctorId;

        const sql = `
            SELECT *
            FROM doctor_leave
            WHERE doctor_id = ?
            ORDER BY leave_date
        `;

        db.query(
            sql,
            [doctorId],
            (err, results) => {

                if (err) {

                    return res.status(500).json({
                        error: err.message
                    });

                }

                res.json(results);

            }
        );

    }
);


// =====================================================
// TIME HELPERS
// =====================================================

function timeToMinutes(time) {

    const parts =
        String(time).split(":");

    return (
        Number(parts[0]) * 60 +
        Number(parts[1])
    );

}


function minutesToTime(minutes) {

    const hours =
        Math.floor(minutes / 60);

    const mins =
        minutes % 60;

    return (
        String(hours).padStart(2, "0") +
        ":" +
        String(mins).padStart(2, "0")
    );

}


// =====================================================
// AVAILABLE SLOTS
// =====================================================

app.get(
    "/doctors/:doctorId/slots",
    (req, res) => {

        const doctorId =
            req.params.doctorId;

        const {
            date
        } = req.query;

        if (!date) {

            return res.status(400).json({
                error:
                    "Date is required"
            });

        }

        const doctorSql = `
            SELECT
                working_start,
                working_end,
                slot_duration
            FROM doctor_profiles
            WHERE doctor_id = ?
        `;

        db.query(
            doctorSql,
            [doctorId],
            (err, doctors) => {

                if (err) {

                    return res.status(500).json({
                        error: err.message
                    });

                }

                if (doctors.length === 0) {

                    return res.status(404).json({
                        error:
                            "Doctor profile not found"
                    });

                }

                const doctor =
                    doctors[0];

                const leaveSql = `
                    SELECT id
                    FROM doctor_leave
                    WHERE doctor_id = ?
                    AND leave_date = ?
                `;

                db.query(
                    leaveSql,
                    [
                        doctorId,
                        date
                    ],
                    (
                        leaveError,
                        leave
                    ) => {

                        if (leaveError) {

                            return res.status(500).json({
                                error:
                                    leaveError.message
                            });

                        }

                        if (leave.length > 0) {

                            return res.json({

                                date: date,

                                available: false,

                                message:
                                    "Doctor is on leave",

                                slots: []

                            });

                        }

                        const bookedSql = `
                            SELECT appointment_time
                            FROM appointments
                            WHERE doctor_id = ?
                            AND appointment_date = ?
                            AND status IN
                            (
                                'pending',
                                'accepted',
                                'confirmed'
                            )
                        `;

                        db.query(
                            bookedSql,
                            [
                                doctorId,
                                date
                            ],
                            (
                                bookingError,
                                booked
                            ) => {

                                if (bookingError) {

                                    return res.status(500).json({
                                        error:
                                            bookingError.message
                                    });

                                }

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

                                const slots = [];

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

                                res.json({

                                    date: date,

                                    available: true,

                                    slots: slots

                                });

                            }
                        );

                    }
                );

            }
        );

    }
);


// =====================================================
// AI PRE-VISIT SYMPTOM SUMMARY
// =====================================================

async function generateAISymptomSummary(symptoms) {

    if (!openai) {

        console.log(
            "AI ERROR: OPENAI_API_KEY is not configured."
        );

        return null;

    }

    if (
        !symptoms ||
        String(symptoms).trim().length === 0
    ) {

        console.log(
            "AI ERROR: Symptoms are empty."
        );

        return null;

    }

    try {

        console.log(
            "Sending symptoms to OpenAI:",
            symptoms
        );


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


        // IMPORTANT:
        // Use the model that is available to your API project.
        // gpt-5.6-luna is the current cost-sensitive model.

        const response =
            await openai.responses.create({

                model: "gpt-5.6-luna",

                input: prompt

            });


        const output =
            response.output_text;


        console.log(
            "OpenAI raw output:",
            output
        );


        if (!output) {

            throw new Error(
                "OpenAI returned an empty response."
            );

        }


        const cleaned =
            output
                .replace(/```json/gi, "")
                .replace(/```/g, "")
                .trim();


        let result;

        try {

            result =
                JSON.parse(cleaned);

        } catch (jsonError) {

            console.error(
                "AI JSON parsing failed."
            );

            console.error(
                "AI output was:",
                cleaned
            );

            throw new Error(
                "AI returned invalid JSON."
            );

        }


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
                            typeof question === "string" &&
                            question.trim().length > 0
                    )
                    .slice(0, 3)
                : [];


        while (
            questions.length < 3
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
            "===================================="
        );

        console.error(
            "AI SYMPTOM SUMMARY ERROR"
        );

        console.error(
            "===================================="
        );

        console.error(
            "Message:",
            error.message
        );

        console.error(
            "Status:",
            error.status || "Not provided"
        );

        console.error(
            "Code:",
            error.code || "Not provided"
        );

        console.error(
            "===================================="
        );

        return null;

    }

}


// =====================================================
// BOOK APPOINTMENT
// =====================================================

app.post(
    "/appointments",
    (req, res) => {

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


        const leaveSql = `
            SELECT id
            FROM doctor_leave
            WHERE doctor_id = ?
            AND leave_date = ?
        `;


        db.query(
            leaveSql,
            [
                doctor_id,
                appointment_date
            ],
            (
                leaveError,
                leave
            ) => {

                if (leaveError) {

                    return res.status(500).json({
                        error:
                            leaveError.message
                    });

                }


                if (leave.length > 0) {

                    return res.status(409).json({
                        error:
                            "Doctor is on leave on this date."
                    });

                }


                const bookingSql = `
                    SELECT id
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
                `;


                db.query(
                    bookingSql,
                    [
                        doctor_id,
                        appointment_date,
                        appointment_time
                    ],
                    (
                        bookingError,
                        existing
                    ) => {

                        if (bookingError) {

                            return res.status(500).json({
                                error:
                                    bookingError.message
                            });

                        }


                        if (
                            existing.length > 0
                        ) {

                            return res.status(409).json({
                                error:
                                    "This appointment slot is already booked."
                            });

                        }


                        const insertSql = `
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
                        `;


                        db.query(
                            insertSql,
                            [
                                patient_id,
                                doctor_id,
                                appointment_date,
                                appointment_time,
                                symptoms
                            ],
                            async (
                                insertError,
                                result
                            ) => {

                                if (insertError) {

                                    return res.status(500).json({
                                        error:
                                            insertError.message
                                    });

                                }


                                const appointmentId =
                                    result.insertId;


                                console.log(
                                    "Appointment created:",
                                    appointmentId
                                );


                                // =================================================
                                // GENERATE AI SUMMARY
                                // =================================================

                                const aiResult =
                                    await generateAISymptomSummary(
                                        symptoms
                                    );


                                if (!aiResult) {

                                    console.log(
                                        "AI summary was not generated for appointment:",
                                        appointmentId
                                    );

                                    return res.status(201).json({

                                        message:
                                            "Appointment booked successfully, but AI summary could not be generated.",

                                        appointmentId:
                                            appointmentId,

                                        aiSummary:
                                            null

                                    });

                                }


                                // =================================================
                                // CREATE TEXT SUMMARY
                                // =================================================

                                const aiText = `
Chief Complaint:
${aiResult.chief_complaint}

Suggested Questions:
1. ${aiResult.suggested_questions[0]}
2. ${aiResult.suggested_questions[1]}
3. ${aiResult.suggested_questions[2]}
                                `.trim();


                                // =================================================
                                // SAVE AI SUMMARY TO MYSQL
                                // =================================================

                                const updateSql = `
                                    UPDATE appointments
                                    SET
                                        ai_summary = ?,
                                        ai_symptom_summary = ?,
                                        urgency = ?
                                    WHERE id = ?
                                `;


                                db.query(
                                    updateSql,
                                    [
                                        aiText,
                                        aiText,
                                        aiResult.urgency,
                                        appointmentId
                                    ],
                                    (
                                        updateError,
                                        updateResult
                                    ) => {

                                        if (updateError) {

                                            console.error(
                                                "AI database update failed:",
                                                updateError.message
                                            );

                                            return res.status(201).json({

                                                message:
                                                    "Appointment booked, but AI summary could not be saved.",

                                                appointmentId:
                                                    appointmentId,

                                                aiSummary:
                                                    aiResult

                                            });

                                        }


                                        console.log(
                                            "AI summary saved successfully."
                                        );

                                        console.log(
                                            "Updated rows:",
                                            updateResult.affectedRows
                                        );


                                        return res.status(201).json({

                                            message:
                                                "Appointment booked successfully",

                                            appointmentId:
                                                appointmentId,

                                            aiSummary:
                                                aiResult

                                        });

                                    }
                                );

                            }
                        );

                    }
                );

            }
        );

    }
);


// =====================================================
// PATIENT APPOINTMENTS
// =====================================================

app.get(
    "/appointments/patient/:patientId",
    (req, res) => {

        const patientId =
            req.params.patientId;


        const sql = `
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
                a.appointment_time DESC
        `;


        db.query(
            sql,
            [patientId],
            (err, results) => {

                if (err) {

                    return res.status(500).json({
                        error: err.message
                    });

                }

                res.json(results);

            }
        );

    }
);


// =====================================================
// DOCTOR APPOINTMENTS
// =====================================================

app.get(
    "/appointments/doctor/:doctorId",
    (req, res) => {

        const doctorId =
            req.params.doctorId;


        const sql = `
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
                a.appointment_time DESC
        `;


        db.query(
            sql,
            [doctorId],
            (err, results) => {

                if (err) {

                    return res.status(500).json({
                        error: err.message
                    });

                }

                res.json(results);

            }
        );

    }
);


// =====================================================
// ACCEPT APPOINTMENT
// =====================================================

app.put(
    "/appointments/:id/accept",
    (req, res) => {

        const id =
            req.params.id;


        const sql = `
            UPDATE appointments
            SET status = 'accepted'
            WHERE id = ?
            AND status = 'pending'
        `;


        db.query(
            sql,
            [id],
            (err, result) => {

                if (err) {

                    return res.status(500).json({
                        error: err.message
                    });

                }


                if (
                    result.affectedRows === 0
                ) {

                    return res.status(400).json({
                        error:
                            "Appointment cannot be accepted"
                    });

                }


                res.json({

                    message:
                        "Appointment accepted successfully"

                });

            }
        );

    }
);


// =====================================================
// REJECT APPOINTMENT
// =====================================================

app.put(
    "/appointments/:id/reject",
    (req, res) => {

        const id =
            req.params.id;


        const sql = `
            UPDATE appointments
            SET status = 'rejected'
            WHERE id = ?
            AND status = 'pending'
        `;


        db.query(
            sql,
            [id],
            (err, result) => {

                if (err) {

                    return res.status(500).json({
                        error: err.message
                    });

                }


                if (
                    result.affectedRows === 0
                ) {

                    return res.status(400).json({
                        error:
                            "Appointment cannot be rejected"
                    });

                }


                res.json({

                    message:
                        "Appointment rejected successfully"

                });

            }
        );

    }
);


// =====================================================
// COMPLETE APPOINTMENT
// =====================================================

app.put(
    "/appointments/:id/complete",
    (req, res) => {

        const id =
            req.params.id;


        const {
            doctor_notes,
            prescription
        } = req.body;


        const visitSummary = `
Patient was evaluated based on the reported symptoms.

Doctor Notes:
${doctor_notes || "No additional notes provided."}

Prescription:
${prescription || "No prescription provided."}

The patient should follow the doctor's recommendations and attend the recommended follow-up.
        `.trim();


        const sql = `
            UPDATE appointments
            SET
                status = 'completed',
                doctor_notes = ?,
                prescription = ?,
                visit_summary = ?
            WHERE id = ?
            AND status = 'accepted'
        `;


        db.query(
            sql,
            [
                doctor_notes || null,
                prescription || null,
                visitSummary,
                id
            ],
            (err, result) => {

                if (err) {

                    return res.status(500).json({
                        error: err.message
                    });

                }


                if (
                    result.affectedRows === 0
                ) {

                    return res.status(400).json({
                        error:
                            "Appointment cannot be completed"
                    });

                }


                res.json({

                    message:
                        "Appointment completed successfully",

                    visitSummary:
                        visitSummary

                });

            }
        );

    }
);


// =====================================================
// PATIENT VISIT SUMMARIES
// =====================================================

app.get(
    "/visit-summaries/:patientId",
    (req, res) => {

        const patientId =
            req.params.patientId;


        const sql = `
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
                a.appointment_time DESC
        `;


        db.query(
            sql,
            [patientId],
            (err, results) => {

                if (err) {

                    return res.status(500).json({
                        error: err.message
                    });

                }

                res.json(results);

            }
        );

    }
);


// =====================================================
// SERVER START
// =====================================================

app.listen(5000, () => {

    console.log(
        "Server running on http://localhost:5000"
    );

});
