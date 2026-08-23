let currentUser = null;


// =====================================================
// GENERAL HELPERS
// =====================================================

function getCurrentUser() {

    const savedUser =
        localStorage.getItem("healthUser");

    if (!savedUser) {

        currentUser = null;

        return null;
    }

    try {

        currentUser =
            JSON.parse(savedUser);

        return currentUser;

    } catch (error) {

        console.error(
            "Invalid stored user:",
            error
        );

        localStorage.removeItem(
            "healthUser"
        );

        currentUser = null;

        return null;
    }
}


function getElement(...ids) {

    for (const id of ids) {

        const element =
            document.getElementById(id);

        if (element) {
            return element;
        }

    }

    return null;
}


function escapeHtml(value) {

    if (
        value === null ||
        value === undefined
    ) {

        return "";

    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function formatDate(date) {

    if (!date) {
        return "";
    }

    // MySQL DATE format: YYYY-MM-DD
    if (
        typeof date === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(date)
    ) {

        const parts =
            date.split("-");

        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }

    const d =
        new Date(date);

    if (Number.isNaN(d.getTime())) {
        return String(date);
    }

    return d.toLocaleDateString("en-GB");
}


function normalizeTime(time) {

    if (!time) {
        return "";
    }

    const value =
        String(time);

    if (
        /^\d{2}:\d{2}:\d{2}$/.test(value)
    ) {

        return value;
    }

    if (
        /^\d{2}:\d{2}$/.test(value)
    ) {

        return `${value}:00`;
    }

    return value;
}


function displayTime(time) {

    if (!time) {
        return "";
    }

    return String(time).slice(0, 8);
}


// =====================================================
// REGISTER
// =====================================================

async function register() {

    const nameElement =
        document.getElementById(
            "registerName"
        );

    const emailElement =
        document.getElementById(
            "registerEmail"
        );

    const passwordElement =
        document.getElementById(
            "registerPassword"
        );

    const roleElement =
        document.getElementById(
            "registerRole"
        );

    const messageElement =
        document.getElementById(
            "registerMessage"
        );

    if (
        !nameElement ||
        !emailElement ||
        !passwordElement ||
        !roleElement ||
        !messageElement
    ) {

        return;
    }

    const name =
        nameElement.value.trim();

    const email =
        emailElement.value.trim();

    const password =
        passwordElement.value;

    const role =
        roleElement.value;

    if (
        !name ||
        !email ||
        !password ||
        !role
    ) {

        messageElement.textContent =
            "Please fill all fields.";

        return;
    }

    try {

        const response =
            await fetch(
                "/users",
                {
                    method: "POST",

                    credentials:
                        "include",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            name,
                            email,
                            password,
                            role
                        })
                }
            );

        const data =
            await response.json();

        if (!response.ok) {

            messageElement.textContent =
                data.error ||
                "Registration failed.";

            return;
        }

        messageElement.textContent =
            data.message ||
            "User registered successfully.";

    } catch (error) {

        console.error(
            "Registration error:",
            error
        );

        messageElement.textContent =
            "Server error.";

    }
}


// =====================================================
// LOGIN
// =====================================================

async function login() {

    const emailElement =
        document.getElementById(
            "loginEmail"
        );

    const passwordElement =
        document.getElementById(
            "loginPassword"
        );

    const messageElement =
        document.getElementById(
            "loginMessage"
        );

    if (
        !emailElement ||
        !passwordElement ||
        !messageElement
    ) {

        return;
    }

    const email =
        emailElement.value.trim();

    const password =
        passwordElement.value;

    if (!email || !password) {

        messageElement.textContent =
            "Enter email and password.";

        return;
    }

    try {

        const response =
            await fetch(
                "/login",
                {
                    method: "POST",

                    credentials:
                        "include",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            email,
                            password
                        })
                }
            );

        const data =
            await response.json();

        if (!response.ok) {

            messageElement.textContent =
                data.error ||
                "Login failed.";

            return;
        }

        if (!data.user) {

            messageElement.textContent =
                "Login succeeded but user data was not returned.";

            return;
        }

        currentUser =
            data.user;

        localStorage.setItem(
            "healthUser",
            JSON.stringify(data.user)
        );

        messageElement.textContent =
            `Welcome ${data.user.name}!`;

        setTimeout(
            () => {

                if (
                    data.user.role ===
                    "patient"
                ) {

                    window.location.href =
                        "/patient.html";

                } else if (
                    data.user.role ===
                    "doctor"
                ) {

                    window.location.href =
                        "/doctor.html";

                } else if (
                    data.user.role ===
                    "admin"
                ) {

                    window.location.href =
                        "/admin.html";

                } else {

                    messageElement.textContent =
                        "Invalid user role.";

                }

            },
            500
        );

    } catch (error) {

        console.error(
            "Login error:",
            error
        );

        messageElement.textContent =
            "Server error. Please try again.";

    }
}


// =====================================================
// LOGOUT
// =====================================================

function logout() {

    localStorage.removeItem(
        "healthUser"
    );

    currentUser = null;

    window.location.href =
        "/index.html";
}


// =====================================================
// LOAD DOCTORS
// =====================================================

async function loadDoctors() {

    const selects = [];

    const doctorIdSelect =
        document.getElementById(
            "doctorId"
        );

    const patientDoctorSelect =
        document.getElementById(
            "patientDoctor"
        );

    const leaveDoctorSelect =
        document.getElementById(
            "leaveDoctor"
        );

    if (doctorIdSelect) {

        selects.push(
            doctorIdSelect
        );
    }

    if (
        patientDoctorSelect &&
        !selects.includes(
            patientDoctorSelect
        )
    ) {

        selects.push(
            patientDoctorSelect
        );
    }

    if (
        leaveDoctorSelect &&
        !selects.includes(
            leaveDoctorSelect
        )
    ) {

        selects.push(
            leaveDoctorSelect
        );
    }

    if (selects.length === 0) {

        return;
    }

    try {

        const response =
            await fetch(
                "/doctors",
                {
                    credentials:
                        "include"
                }
            );

        const doctors =
            await response.json();

        if (!response.ok) {

            selects.forEach(
                select => {

                    select.innerHTML = `
                        <option value="">
                            Unable to load doctors
                        </option>
                    `;

                }
            );

            return;
        }

        selects.forEach(
            select => {

                select.innerHTML = `
                    <option value="">
                        Select Doctor
                    </option>
                `;

                if (
                    Array.isArray(
                        doctors
                    )
                ) {

                    doctors.forEach(
                        doctor => {

                            const option =
                                document.createElement(
                                    "option"
                                );

                            option.value =
                                doctor.id;

                            option.textContent =
                                `${doctor.name} - ${
                                    doctor.specialisation ||
                                    "General Physician"
                                }`;

                            select.appendChild(
                                option
                            );

                        }
                    );

                }

            }
        );

    } catch (error) {

        console.error(
            "Doctor loading error:",
            error
        );

        selects.forEach(
            select => {

                select.innerHTML = `
                    <option value="">
                        Unable to load doctors
                    </option>
                `;

            }
        );

    }
}


// =====================================================
// LOAD AVAILABLE SLOTS
// =====================================================

async function loadAvailableSlots() {

    const doctorElement =
        getElement(
            "doctorId",
            "patientDoctor"
        );

    const dateElement =
        document.getElementById(
            "appointmentDate"
        );

    const slotsContainer =
        document.getElementById(
            "availableSlots"
        );

    const timeInput =
        document.getElementById(
            "appointmentTime"
        );

    if (
        !doctorElement ||
        !dateElement ||
        !slotsContainer ||
        !timeInput
    ) {

        return;
    }

    const doctorId =
        doctorElement.value;

    const date =
        dateElement.value;

    timeInput.value =
        "";

    if (!doctorId || !date) {

        slotsContainer.innerHTML =
            "<p>Please select a doctor and date.</p>";

        return;
    }

    slotsContainer.innerHTML =
        "<p>Loading available slots...</p>";

    try {

        const response =
            await fetch(
                `/doctors/${doctorId}/slots?date=${encodeURIComponent(
                    date
                )}`,
                {
                    credentials:
                        "include",

                    cache:
                        "no-store"
                }
            );

        const data =
            await response.json();

        if (!response.ok) {

            slotsContainer.innerHTML =
                `<p>${escapeHtml(
                    data.error ||
                    "Unable to load slots."
                )}</p>`;

            return;
        }

        if (!data.available) {

            slotsContainer.innerHTML =
                `<p>${escapeHtml(
                    data.message ||
                    "Doctor is unavailable."
                )}</p>`;

            return;
        }

        if (
            !Array.isArray(
                data.slots
            ) ||
            data.slots.length === 0
        ) {

            slotsContainer.innerHTML =
                "<p>No available slots for this date.</p>";

            return;
        }

        slotsContainer.innerHTML =
            "";

        data.slots.forEach(
            slot => {

                const button =
                    document.createElement(
                        "button"
                    );

                button.type =
                    "button";

                button.className =
                    "slot-button";

                button.textContent =
                    slot;

                button.addEventListener(
                    "click",
                    () => {

                        document
                            .querySelectorAll(
                                "#availableSlots .slot-button"
                            )
                            .forEach(
                                btn => {

                                    btn.classList.remove(
                                        "selected-slot"
                                    );

                                }
                            );

                        button.classList.add(
                            "selected-slot"
                        );

                        timeInput.value =
                            slot;

                    }
                );

                slotsContainer.appendChild(
                    button
                );

            }
        );

    } catch (error) {

        console.error(
            "Available slot error:",
            error
        );

        slotsContainer.innerHTML =
            "<p>Unable to load available slots.</p>";

    }
}


// =====================================================
// BOOK APPOINTMENT
// =====================================================

async function bookAppointment() {

    const user =
        getCurrentUser();

    const message =
        document.getElementById(
            "appointmentMessage"
        );

    if (!message) {

        return;
    }

    if (!user) {

        message.textContent =
            "Please login first.";

        return;
    }

    if (
        user.role !==
        "patient"
    ) {

        message.textContent =
            "Only patients can book appointments.";

        return;
    }

    const doctorElement =
        getElement(
            "doctorId",
            "patientDoctor"
        );

    const dateElement =
        document.getElementById(
            "appointmentDate"
        );

    const timeElement =
        document.getElementById(
            "appointmentTime"
        );

    const symptomsElement =
        document.getElementById(
            "symptoms"
        );

    if (
        !doctorElement ||
        !dateElement ||
        !timeElement ||
        !symptomsElement
    ) {

        message.textContent =
            "Appointment form is incomplete.";

        return;
    }

    const doctorId =
        Number(
            doctorElement.value
        );

    const appointmentDate =
        dateElement.value;

    const appointmentTime =
        timeElement.value;

    const symptoms =
        symptomsElement.value.trim();

    if (!doctorId) {

        message.textContent =
            "Please select a doctor.";

        return;
    }

    if (!appointmentDate) {

        message.textContent =
            "Please select a date.";

        return;
    }

    if (!appointmentTime) {

        message.textContent =
            "Please select an available slot.";

        return;
    }

    if (!symptoms) {

        message.textContent =
            "Please enter your symptoms.";

        return;
    }

    try {

        const response =
            await fetch(
                "/appointments",
                {

                    method:
                        "POST",

                    credentials:
                        "include",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({

                            patient_id:
                                Number(
                                    user.id
                                ),

                            doctor_id:
                                doctorId,

                            appointment_date:
                                appointmentDate,

                            appointment_time:
                                appointmentTime,

                            symptoms:
                                symptoms

                        })

                }
            );

        const data =
            await response.json();

        if (!response.ok) {

            message.textContent =
                data.error ||
                "Appointment booking failed.";

            return;
        }

        let successMessage =
            data.message ||
            "Appointment booked successfully.";

        if (
            data.calendarCreated ===
            true
        ) {

            successMessage +=
                " Google Calendar event created.";

        } else if (
            data.calendarError
        ) {

            successMessage +=
                ` Google Calendar: ${data.calendarError}`;

        }

        message.textContent =
            successMessage;

        symptomsElement.value =
            "";

        await loadAvailableSlots();

        await loadPatientAppointments();

    } catch (error) {

        console.error(
            "Booking error:",
            error
        );

        message.textContent =
            "Server error. Please try again.";

    }
}


// =====================================================
// LOAD PATIENT APPOINTMENTS
// =====================================================

async function loadPatientAppointments() {

    const user =
        getCurrentUser();

    const container =
        document.getElementById(
            "patientAppointments"
        );

    if (!container) {

        return;
    }

    if (
        !user ||
        user.role !==
        "patient"
    ) {

        container.innerHTML =
            "<p>Please login as a patient.</p>";

        return;
    }

    container.innerHTML =
        "<p>Loading appointments...</p>";

    try {

        const response =
            await fetch(
                `/appointments/patient/${user.id}`,
                {
                    credentials:
                        "include",

                    cache:
                        "no-store"
                }
            );

        const appointments =
            await response.json();

        if (!response.ok) {

            container.innerHTML =
                `<p>${escapeHtml(
                    appointments.error ||
                    "Unable to load appointments."
                )}</p>`;

            return;
        }

        if (
            !Array.isArray(
                appointments
            ) ||
            appointments.length === 0
        ) {

            container.innerHTML =
                "<p>No appointments found.</p>";

            return;
        }

        container.innerHTML =
            "";

        appointments.forEach(
            (appointment, index) => {

                const card =
                    document.createElement(
                        "div"
                    );

                card.className =
                    "appointment-card";

                const status =
                    String(
                        appointment.status ||
                        ""
                    ).toLowerCase();

                const canModify =
                    [
                        "pending",
                        "accepted",
                        "confirmed"
                    ].includes(
                        status
                    );

                card.innerHTML = `

                    <h3>
                        Appointment #${index + 1}
                    </h3>

                    <p>
                        <strong>Doctor:</strong>
                        ${escapeHtml(
                            appointment.doctor_name ||
                            "Unknown"
                        )}
                    </p>

                    <p>
                        <strong>Doctor Email:</strong>
                        ${escapeHtml(
                            appointment.doctor_email ||
                            "Not available"
                        )}
                    </p>

                    <p>
                        <strong>Date:</strong>
                        ${formatDate(
                            appointment.appointment_date
                        )}
                    </p>

                    <p>
                        <strong>Time:</strong>
                        ${escapeHtml(
                            displayTime(
                                appointment.appointment_time
                            )
                        )}
                    </p>

                    <p>
                        <strong>Symptoms:</strong>
                        ${escapeHtml(
                            appointment.symptoms ||
                            "None"
                        )}
                    </p>

                    <p>
                        <strong>Status:</strong>

                        <span class="
                            status
                            status-${escapeHtml(status)}
                        ">
                            ${escapeHtml(
                                status.toUpperCase()
                            )}
                        </span>
                    </p>

                    ${
                        appointment.ai_summary
                            ? `
                                <div class="ai-summary">

                                    <h4>
                                        AI Pre-Visit Summary
                                    </h4>

                                    <p class="summary-text">
                                        ${escapeHtml(
                                            appointment.ai_summary
                                        )}
                                    </p>

                                </div>
                            `
                            : ""
                    }

                    ${
                        canModify
                            ? `

                                <div class="appointment-actions">

                                    <button
                                        type="button"
                                        class="reschedule-button"
                                        onclick="openReschedule(
                                            ${Number(
                                                appointment.id
                                            )},
                                            ${Number(
                                                appointment.doctor_id
                                            )}
                                        )"
                                    >
                                        Reschedule
                                    </button>

                                    <button
                                        type="button"
                                        class="danger-button"
                                        onclick="cancelAppointment(
                                            ${Number(
                                                appointment.id
                                            )}
                                        )"
                                    >
                                        Cancel
                                    </button>

                                </div>

                            `
                            : ""
                    }

                `;

                container.appendChild(
                    card
                );

            }
        );

    } catch (error) {

        console.error(
            "Patient appointment error:",
            error
        );

        container.innerHTML =
            "<p>Unable to load appointments.</p>";

    }
}


// =====================================================
// CREATE RESCHEDULE SECTION IF MISSING
// =====================================================

function ensureRescheduleSection() {

    let section =
        document.getElementById(
            "rescheduleSection"
        );

    if (section) {

        return section;
    }

    section =
        document.createElement(
            "div"
        );

    section.id =
        "rescheduleSection";

    section.className =
        "card hidden reschedule-section";

    section.innerHTML = `

        <h2>
            Reschedule Appointment
        </h2>

        <input
            type="hidden"
            id="rescheduleAppointmentId"
        >

        <input
            type="hidden"
            id="rescheduleDoctorId"
        >

        <label for="rescheduleDate">
            New Date
        </label>

        <input
            type="date"
            id="rescheduleDate"
            onchange="loadRescheduleSlots()"
        >

        <h3>
            Available Slots
        </h3>

        <div id="rescheduleSlots">
            <p>Please select a new date.</p>
        </div>

        <input
            type="hidden"
            id="rescheduleTime"
        >

        <p
            id="rescheduleMessage"
            class="message"
        ></p>

        <button
            type="button"
            onclick="confirmReschedule()"
        >
            Confirm Reschedule
        </button>

        <button
            type="button"
            class="secondary-button"
            onclick="closeReschedule()"
        >
            Close
        </button>

    `;

    const appointmentsContainer =
        document.getElementById(
            "patientAppointments"
        );

    if (
        appointmentsContainer &&
        appointmentsContainer.parentElement
    ) {

        appointmentsContainer.parentElement.insertBefore(
            section,
            appointmentsContainer
        );

    } else {

        document.body.appendChild(
            section
        );

    }

    return section;
}


// =====================================================
// RESCHEDULE - OPEN
// =====================================================

function openReschedule(
    appointmentId,
    doctorId
) {

    const section =
        ensureRescheduleSection();

    const appointmentIdElement =
        document.getElementById(
            "rescheduleAppointmentId"
        );

    const doctorIdElement =
        document.getElementById(
            "rescheduleDoctorId"
        );

    const dateElement =
        document.getElementById(
            "rescheduleDate"
        );

    const timeElement =
        document.getElementById(
            "rescheduleTime"
        );

    const slotsContainer =
        document.getElementById(
            "rescheduleSlots"
        );

    const message =
        document.getElementById(
            "rescheduleMessage"
        );

    if (
        !section ||
        !appointmentIdElement ||
        !doctorIdElement ||
        !dateElement ||
        !timeElement ||
        !slotsContainer
    ) {

        alert(
            "Unable to open reschedule form."
        );

        return;
    }

    appointmentIdElement.value =
        Number(
            appointmentId
        );

    doctorIdElement.value =
        Number(
            doctorId
        );

    dateElement.value =
        "";

    timeElement.value =
        "";

    slotsContainer.innerHTML =
        "<p>Please select a new date.</p>";

    if (message) {

        message.textContent =
            "";

    }

    section.classList.remove(
        "hidden"
    );

    section.scrollIntoView({
        behavior:
            "smooth",

        block:
            "start"
    });
}


// =====================================================
// RESCHEDULE - CLOSE
// =====================================================

function closeReschedule() {

    const section =
        document.getElementById(
            "rescheduleSection"
        );

    if (section) {

        section.classList.add(
            "hidden"
        );

    }
}


// =====================================================
// RESCHEDULE - LOAD SLOTS
// =====================================================

async function loadRescheduleSlots() {

    const doctorElement =
        document.getElementById(
            "rescheduleDoctorId"
        );

    const dateElement =
        document.getElementById(
            "rescheduleDate"
        );

    const timeElement =
        document.getElementById(
            "rescheduleTime"
        );

    const slotsContainer =
        document.getElementById(
            "rescheduleSlots"
        );

    if (
        !doctorElement ||
        !dateElement ||
        !timeElement ||
        !slotsContainer
    ) {

        return;
    }

    const doctorId =
        Number(
            doctorElement.value
        );

    const date =
        dateElement.value;

    timeElement.value =
        "";

    if (!doctorId || !date) {

        slotsContainer.innerHTML =
            "<p>Please select a new date.</p>";

        return;
    }

    slotsContainer.innerHTML =
        "<p>Loading available slots...</p>";

    try {

        const response =
            await fetch(
                `/doctors/${doctorId}/slots?date=${encodeURIComponent(
                    date
                )}`,
                {
                    credentials:
                        "include",

                    cache:
                        "no-store"
                }
            );

        const data =
            await response.json();

        if (!response.ok) {

            slotsContainer.innerHTML =
                `<p>${escapeHtml(
                    data.error ||
                    "Unable to load slots."
                )}</p>`;

            return;
        }

        if (!data.available) {

            slotsContainer.innerHTML =
                `<p>${escapeHtml(
                    data.message ||
                    "Doctor is unavailable."
                )}</p>`;

            return;
        }

        if (
            !Array.isArray(
                data.slots
            ) ||
            data.slots.length === 0
        ) {

            slotsContainer.innerHTML =
                "<p>No available slots.</p>";

            return;
        }

        slotsContainer.innerHTML =
            "";

        data.slots.forEach(
            slot => {

                const button =
                    document.createElement(
                        "button"
                    );

                button.type =
                    "button";

                button.className =
                    "reschedule-slot";

                button.textContent =
                    slot;

                button.addEventListener(
                    "click",
                    () => {

                        document
                            .querySelectorAll(
                                "#rescheduleSlots .reschedule-slot"
                            )
                            .forEach(
                                item => {

                                    item.classList.remove(
                                        "selected-slot"
                                    );

                                }
                            );

                        button.classList.add(
                            "selected-slot"
                        );

                        timeElement.value =
                            slot;

                    }
                );

                slotsContainer.appendChild(
                    button
                );

            }
        );

    } catch (error) {

        console.error(
            "Reschedule slots error:",
            error
        );

        slotsContainer.innerHTML =
            "<p>Unable to load available slots.</p>";

    }
}


// =====================================================
// RESCHEDULE - CONFIRM
// =====================================================

async function confirmReschedule() {

    const appointmentIdElement =
        document.getElementById(
            "rescheduleAppointmentId"
        );

    const dateElement =
        document.getElementById(
            "rescheduleDate"
        );

    const timeElement =
        document.getElementById(
            "rescheduleTime"
        );

    const message =
        document.getElementById(
            "rescheduleMessage"
        );

    if (!message) {

        return;
    }

    const appointmentId =
        Number(
            appointmentIdElement?.value
        );

    const appointmentDate =
        dateElement?.value ||
        "";

    const appointmentTime =
        timeElement?.value ||
        "";

    if (
        !Number.isInteger(
            appointmentId
        ) ||
        appointmentId <= 0
    ) {

        message.textContent =
            "Invalid appointment ID.";

        return;
    }

    if (!appointmentDate) {

        message.textContent =
            "Please select a new date.";

        return;
    }

    if (!appointmentTime) {

        message.textContent =
            "Please select an available slot.";

        return;
    }

    message.textContent =
        "Rescheduling appointment...";

    try {

        const response =
            await fetch(
                `/appointments/${appointmentId}/reschedule`,
                {

                    method:
                        "PUT",

                    credentials:
                        "include",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({

                            appointment_date:
                                appointmentDate,

                            appointment_time:
                                appointmentTime

                        })

                }
            );

        const data =
            await response.json();

        if (!response.ok) {

            message.textContent =
                data.error ||
                "Appointment rescheduling failed.";

            return;
        }

        if (
            data.calendarUpdated ===
            true
        ) {

            message.textContent =
                "Appointment rescheduled successfully. Google Calendar was updated.";

        } else if (
            data.calendarError
        ) {

            message.textContent =
                `Appointment rescheduled successfully, but Google Calendar was not updated: ${data.calendarError}`;

        } else {

            message.textContent =
                "Appointment rescheduled successfully.";

        }

        await loadPatientAppointments();

        setTimeout(
            () => {

                closeReschedule();

            },
            1800
        );

    } catch (error) {

        console.error(
            "Reschedule error:",
            error
        );

        message.textContent =
            "Server error while rescheduling appointment.";

    }
}


// =====================================================
// CANCEL APPOINTMENT
// =====================================================

async function cancelAppointment(
    id
) {

    const appointmentId =
        Number(id);

    if (
        !Number.isInteger(
            appointmentId
        ) ||
        appointmentId <= 0
    ) {

        alert(
            "Invalid appointment ID."
        );

        return;
    }

    const confirmed =
        window.confirm(
            "Are you sure you want to cancel this appointment?"
        );

    if (!confirmed) {

        return;
    }

    try {

        const response =
            await fetch(
                `/appointments/${appointmentId}/cancel`,
                {

                    method:
                        "PUT",

                    credentials:
                        "include"

                }
            );

        const data =
            await response.json();

        if (!response.ok) {

            alert(
                data.error ||
                "Unable to cancel appointment."
            );

            return;
        }

        alert(
            data.message ||
            "Appointment cancelled successfully."
        );

        await loadPatientAppointments();

    } catch (error) {

        console.error(
            "Cancel appointment error:",
            error
        );

        alert(
            "Server error while cancelling appointment."
        );

    }
}


// =====================================================
// LOAD VISIT SUMMARIES
// =====================================================

async function loadVisitSummaries() {

    const user =
        getCurrentUser();

    const container =
        document.getElementById(
            "visitSummaries"
        );

    if (!container) {

        return;
    }

    if (
        !user ||
        user.role !==
        "patient"
    ) {

        container.innerHTML =
            "<p>Please login as a patient.</p>";

        return;
    }

    container.innerHTML =
        "<p>Loading visit summaries...</p>";

    try {

        const response =
            await fetch(
                `/visit-summaries/${user.id}`,
                {
                    credentials:
                        "include",

                    cache:
                        "no-store"
                }
            );

        const summaries =
            await response.json();

        if (!response.ok) {

            container.innerHTML =
                `<p>${escapeHtml(
                    summaries.error ||
                    "Unable to load summaries."
                )}</p>`;

            return;
        }

        if (
            !Array.isArray(
                summaries
            ) ||
            summaries.length === 0
        ) {

            container.innerHTML =
                "<p>No completed visits yet.</p>";

            return;
        }

        container.innerHTML =
            "";

        summaries.forEach(
            (summary, index) => {

                const card =
                    document.createElement(
                        "div"
                    );

                card.className =
                    "visit-summary-card";

                card.innerHTML = `

                    <h3>
                        Visit Summary #${index + 1}
                    </h3>

                    <p>
                        <strong>Doctor:</strong>
                        ${escapeHtml(
                            summary.doctor_name ||
                            "Unknown"
                        )}
                    </p>

                    <p>
                        <strong>Date:</strong>
                        ${formatDate(
                            summary.appointment_date
                        )}
                    </p>

                    <p>
                        <strong>Time:</strong>
                        ${escapeHtml(
                            displayTime(
                                summary.appointment_time
                            )
                        )}
                    </p>

                    <p>
                        <strong>Symptoms:</strong>
                        ${escapeHtml(
                            summary.symptoms ||
                            "None"
                        )}
                    </p>

                    <h4>
                        Patient-Friendly Visit Summary
                    </h4>

                    <p class="summary-text">
                        ${escapeHtml(
                            summary.visit_summary ||
                            "No summary available."
                        )}
                    </p>

                    <p>
                        <strong>Prescription:</strong>
                        ${escapeHtml(
                            summary.prescription ||
                            "No prescription provided."
                        )}
                    </p>

                `;

                container.appendChild(
                    card
                );

            }
        );

    } catch (error) {

        console.error(
            "Visit summary error:",
            error
        );

        container.innerHTML =
            "<p>Unable to load visit summaries.</p>";

    }
}


// =====================================================
// LOAD MEDICATIONS
// IMPORTANT:
// ONLY runs when the patient clicks
// "Load Medications".
// =====================================================

async function loadMedications() {

    const user =
        getCurrentUser();

    const container =
        document.getElementById(
            "medications"
        );

    if (!container) {

        console.error(
            "Medication container #medications was not found."
        );

        return;
    }

    if (
        !user ||
        user.role !==
        "patient"
    ) {

        container.innerHTML =
            "<p>Please login as a patient.</p>";

        return;
    }

    container.innerHTML =
        "<p>Loading medications...</p>";

    try {

        console.log(
            "Loading medications for patient:",
            user.id
        );

        const response =
            await fetch(
                `/medications/patient/${user.id}`,
                {

                    method:
                        "GET",

                    credentials:
                        "include",

                    cache:
                        "no-store"
                }
            );

        const medications =
            await response.json();

        console.log(
            "Medication API response:",
            medications
        );

        if (!response.ok) {

            container.innerHTML =
                `<p>${escapeHtml(
                    medications.error ||
                    "Unable to load medications."
                )}</p>`;

            return;
        }

        if (
            !Array.isArray(
                medications
            ) ||
            medications.length === 0
        ) {

            container.innerHTML =
                "<p>No medications found.</p>";

            return;
        }

        container.innerHTML =
            "";

        medications.forEach(
            (medication, index) => {

                const card =
                    document.createElement(
                        "div"
                    );

                card.className =
                    "medication-card";

                const reminderTimes =
                    medication.reminder_times ||
                    medication.reminder_time ||
                    "Not specified";

                card.innerHTML = `

                    <h3>
                        Medication #${index + 1}
                    </h3>

                    <p>
                        <strong>Medication:</strong>
                        ${escapeHtml(
                            medication.medication_name ||
                            "Not specified"
                        )}
                    </p>

                    <p>
                        <strong>Dosage:</strong>
                        ${escapeHtml(
                            medication.dosage ||
                            "As prescribed"
                        )}
                    </p>

                    <p>
                        <strong>Frequency:</strong>
                        ${escapeHtml(
                            medication.frequency ||
                            "As prescribed"
                        )}
                    </p>

                    <p>
                        <strong>Reminder Time:</strong>
                        ${escapeHtml(
                            reminderTimes
                        )}
                    </p>

                    <p>
                        <strong>Start Date:</strong>
                        ${formatDate(
                            medication.start_date
                        )}
                    </p>

                    <p>
                        <strong>End Date:</strong>
                        ${
                            medication.end_date
                                ? formatDate(
                                    medication.end_date
                                )
                                : "Ongoing"
                        }
                    </p>

                `;

                container.appendChild(
                    card
                );

            }
        );

    } catch (error) {

        console.error(
            "Medication loading error:",
            error
        );

        container.innerHTML =
            "<p>Unable to load medications.</p>";

    }
}


// =====================================================
// LOAD DOCTOR APPOINTMENTS
// =====================================================

async function loadDoctorAppointments() {

    const user =
        getCurrentUser();

    const container =
        getElement(
            "appointmentsList",
            "doctorAppointments"
        );

    if (!container) {

        return;
    }

    if (
        !user ||
        user.role !==
        "doctor"
    ) {

        container.innerHTML =
            "<p>Please login as a doctor.</p>";

        return;
    }

    container.innerHTML =
        "<p>Loading appointments...</p>";

    try {

        const response =
            await fetch(
                `/appointments/doctor/${user.id}`,
                {
                    credentials:
                        "include",

                    cache:
                        "no-store"
                }
            );

        const appointments =
            await response.json();

        if (!response.ok) {

            container.innerHTML =
                `<p>${escapeHtml(
                    appointments.error ||
                    "Unable to load appointments."
                )}</p>`;

            return;
        }

        if (
            !Array.isArray(
                appointments
            ) ||
            appointments.length === 0
        ) {

            container.innerHTML =
                "<p>No appointments found.</p>";

            return;
        }

        container.innerHTML =
            "";

        appointments.forEach(
            (appointment, index) => {

                const card =
                    document.createElement(
                        "div"
                    );

                card.className =
                    "appointment-card";

                const status =
                    String(
                        appointment.status ||
                        ""
                    ).toLowerCase();

                card.innerHTML = `

                    <h3>
                        Appointment #${index + 1}
                    </h3>

                    <p>
                        <strong>Patient:</strong>
                        ${escapeHtml(
                            appointment.patient_name ||
                            "Unknown"
                        )}
                    </p>

                    <p>
                        <strong>Patient Email:</strong>
                        ${escapeHtml(
                            appointment.patient_email ||
                            "Not available"
                        )}
                    </p>

                    <p>
                        <strong>Date:</strong>
                        ${formatDate(
                            appointment.appointment_date
                        )}
                    </p>

                    <p>
                        <strong>Time:</strong>
                        ${escapeHtml(
                            displayTime(
                                appointment.appointment_time
                            )
                        )}
                    </p>

                    <p>
                        <strong>Symptoms:</strong>
                        ${escapeHtml(
                            appointment.symptoms ||
                            "None"
                        )}
                    </p>

                    ${
                        appointment.ai_summary
                            ? `
                                <div class="ai-summary">

                                    <h4>
                                        AI Pre-Visit Summary
                                    </h4>

                                    <p class="summary-text">
                                        ${escapeHtml(
                                            appointment.ai_summary
                                        )}
                                    </p>

                                </div>
                            `
                            : ""
                    }

                    <p>
                        <strong>Status:</strong>

                        <span class="
                            status
                            status-${escapeHtml(status)}
                        ">
                            ${escapeHtml(
                                status.toUpperCase()
                            )}
                        </span>
                    </p>

                    ${
                        status ===
                        "pending"
                            ? `

                                <div class="appointment-actions">

                                    <button
                                        type="button"
                                        onclick="acceptAppointment(
                                            ${Number(
                                                appointment.id
                                            )}
                                        )"
                                    >
                                        Accept
                                    </button>

                                    <button
                                        type="button"
                                        class="danger-button"
                                        onclick="rejectAppointment(
                                            ${Number(
                                                appointment.id
                                            )}
                                        )"
                                    >
                                        Reject
                                    </button>

                                </div>

                            `
                            : ""
                    }

                    ${
                        status ===
                        "accepted"
                            ? `

                                <div class="form-box">

                                    <h4>
                                        Complete Appointment
                                    </h4>

                                    <label>
                                        Doctor Notes
                                    </label>

                                    <textarea
                                        id="notes-${Number(
                                            appointment.id
                                        )}"
                                        placeholder="Enter doctor notes"
                                    ></textarea>

                                    <label>
                                        Prescription
                                    </label>

                                    <textarea
                                        id="prescription-${Number(
                                            appointment.id
                                        )}"
                                        placeholder="Example: Paracetamol 500mg - Take after food when required for fever."
                                    ></textarea>

                                    <button
                                        type="button"
                                        onclick="completeAppointment(
                                            ${Number(
                                                appointment.id
                                            )}
                                        )"
                                    >
                                        Complete Appointment
                                    </button>

                                </div>

                            `
                            : ""
                    }

                `;

                container.appendChild(
                    card
                );

            }
        );

    } catch (error) {

        console.error(
            "Doctor appointment error:",
            error
        );

        container.innerHTML =
            "<p>Unable to load doctor appointments.</p>";

    }
}


// =====================================================
// ACCEPT APPOINTMENT
// =====================================================

async function acceptAppointment(id) {

    const appointmentId =
        Number(id);

    if (
        !Number.isInteger(
            appointmentId
        ) ||
        appointmentId <= 0
    ) {

        alert(
            "Invalid appointment ID."
        );

        return;
    }

    try {

        const response =
            await fetch(
                `/appointments/${appointmentId}/accept`,
                {

                    method:
                        "PUT",

                    credentials:
                        "include"
                }
            );

        const data =
            await response.json();

        if (!response.ok) {

            alert(
                data.error ||
                "Unable to accept appointment."
            );

            return;
        }

        alert(
            data.message ||
            "Appointment accepted."
        );

        await loadDoctorAppointments();

    } catch (error) {

        console.error(
            "Accept error:",
            error
        );

        alert(
            "Server error while accepting appointment."
        );

    }
}


// =====================================================
// REJECT APPOINTMENT
// =====================================================

async function rejectAppointment(id) {

    const appointmentId =
        Number(id);

    if (
        !Number.isInteger(
            appointmentId
        ) ||
        appointmentId <= 0
    ) {

        alert(
            "Invalid appointment ID."
        );

        return;
    }

    try {

        const response =
            await fetch(
                `/appointments/${appointmentId}/reject`,
                {

                    method:
                        "PUT",

                    credentials:
                        "include"
                }
            );

        const data =
            await response.json();

        if (!response.ok) {

            alert(
                data.error ||
                "Unable to reject appointment."
            );

            return;
        }

        alert(
            data.message ||
            "Appointment rejected."
        );

        await loadDoctorAppointments();

    } catch (error) {

        console.error(
            "Reject error:",
            error
        );

        alert(
            "Server error while rejecting appointment."
        );

    }
}


// =====================================================
// COMPLETE APPOINTMENT
// =====================================================

async function completeAppointment(id) {

    const appointmentId =
        Number(id);

    if (
        !Number.isInteger(
            appointmentId
        ) ||
        appointmentId <= 0
    ) {

        alert(
            "Invalid appointment ID."
        );

        return;
    }

    const notesElement =
        document.getElementById(
            `notes-${appointmentId}`
        );

    const prescriptionElement =
        document.getElementById(
            `prescription-${appointmentId}`
        );

    const doctorNotes =
        notesElement
            ? notesElement.value.trim()
            : "";

    const prescription =
        prescriptionElement
            ? prescriptionElement.value.trim()
            : "";

    if (
        !doctorNotes &&
        !prescription
    ) {

        alert(
            "Enter doctor notes or prescription."
        );

        return;
    }

    try {

        const response =
            await fetch(
                `/appointments/${appointmentId}/complete`,
                {

                    method:
                        "PUT",

                    credentials:
                        "include",

                    headers: {

                        "Content-Type":
                            "application/json"

                    },

                    body:
                        JSON.stringify({

                            doctor_notes:
                                doctorNotes,

                            prescription:
                                prescription

                        })

                }
            );

        const data =
            await response.json();

        if (!response.ok) {

            alert(
                data.error ||
                "Unable to complete appointment."
            );

            return;
        }

        alert(
            data.message ||
            "Appointment completed successfully."
        );

        await loadDoctorAppointments();

    } catch (error) {

        console.error(
            "Complete error:",
            error
        );

        alert(
            "Server error while completing appointment."
        );

    }
}


// =====================================================
// ADD DOCTOR
// =====================================================

async function addDoctor() {

    const message =
        document.getElementById(
            "doctorMessage"
        );

    const name =
        document.getElementById(
            "doctorName"
        )?.value.trim();

    const email =
        document.getElementById(
            "doctorEmail"
        )?.value.trim();

    const password =
        document.getElementById(
            "doctorPassword"
        )?.value;

    const specialisation =
        document.getElementById(
            "doctorSpecialisation"
        )?.value.trim();

    const workingStart =
        document.getElementById(
            "workingStart"
        )?.value;

    const workingEnd =
        document.getElementById(
            "workingEnd"
        )?.value;

    const slotDuration =
        document.getElementById(
            "slotDuration"
        )?.value;

    if (
        !name ||
        !email ||
        !password ||
        !specialisation ||
        !workingStart ||
        !workingEnd ||
        !slotDuration
    ) {

        if (message) {

            message.textContent =
                "Please fill all doctor fields.";

        }

        return;
    }

    try {

        const response =
            await fetch(
                "/admin/doctors",
                {

                    method:
                        "POST",

                    credentials:
                        "include",

                    headers: {

                        "Content-Type":
                            "application/json"

                    },

                    body:
                        JSON.stringify({

                            name,
                            email,
                            password,
                            specialisation,

                            working_start:
                                workingStart,

                            working_end:
                                workingEnd,

                            slot_duration:
                                Number(
                                    slotDuration
                                )

                        })

                }
            );

        const data =
            await response.json();

        if (message) {

            message.textContent =
                data.message ||
                data.error ||
                "";

        }

        if (response.ok) {

            await loadDoctors();

        }

    } catch (error) {

        console.error(
            "Add doctor error:",
            error
        );

        if (message) {

            message.textContent =
                "Server error while adding doctor.";

        }

    }
}


// =====================================================
// ADD DOCTOR LEAVE
// =====================================================

async function addLeave() {

    const doctorId =
        document.getElementById(
            "leaveDoctor"
        )?.value;

    const leaveDate =
        document.getElementById(
            "leaveDate"
        )?.value;

    const reason =
        document.getElementById(
            "leaveReason"
        )?.value.trim();

    const message =
        document.getElementById(
            "leaveMessage"
        );

    if (
        !doctorId ||
        !leaveDate
    ) {

        if (message) {

            message.textContent =
                "Select doctor and leave date.";

        }

        return;
    }

    try {

        const response =
            await fetch(
                `/doctors/${doctorId}/leave`,
                {

                    method:
                        "POST",

                    credentials:
                        "include",

                    headers: {

                        "Content-Type":
                            "application/json"

                    },

                    body:
                        JSON.stringify({

                            leave_date:
                                leaveDate,

                            reason:
                                reason ||
                                null

                        })

                }
            );

        const data =
            await response.json();

        if (message) {

            message.textContent =
                data.message ||
                data.error ||
                "";

        }

    } catch (error) {

        console.error(
            "Leave error:",
            error
        );

        if (message) {

            message.textContent =
                "Server error while adding leave.";

        }

    }
}


// =====================================================
// LOAD ALL APPOINTMENTS - ADMIN
// =====================================================

async function loadAllAppointments() {

    const container =
        document.getElementById(
            "adminAppointments"
        );

    if (!container) {

        return;
    }

    const user =
        getCurrentUser();

    if (
        !user ||
        user.role !==
        "admin"
    ) {

        container.innerHTML =
            "<p>Please login as an administrator.</p>";

        return;
    }

    container.innerHTML =
        "<p>Loading appointments...</p>";

    try {

        const response =
            await fetch(
                "/appointments/all",
                {
                    credentials:
                        "include",

                    cache:
                        "no-store"
                }
            );

        const data =
            await response.json();

        if (!response.ok) {

            container.innerHTML =
                `<p>${escapeHtml(
                    data.error ||
                    "Admin appointment endpoint is unavailable."
                )}</p>`;

            return;
        }

        if (
            !Array.isArray(
                data
            ) ||
            data.length === 0
        ) {

            container.innerHTML =
                "<p>No appointments found.</p>";

            return;
        }

        container.innerHTML =
            "";

        data.forEach(
            appointment => {

                const card =
                    document.createElement(
                        "div"
                    );

                card.className =
                    "appointment-card";

                const status =
                    String(
                        appointment.status ||
                        ""
                    ).toLowerCase();

                card.innerHTML = `

                    <h3>
                        Appointment #${Number(
                            appointment.id
                        )}
                    </h3>

                    <p>
                        <strong>Patient:</strong>
                        ${escapeHtml(
                            appointment.patient_name ||
                            ""
                        )}
                    </p>

                    <p>
                        <strong>Patient Email:</strong>
                        ${escapeHtml(
                            appointment.patient_email ||
                            ""
                        )}
                    </p>

                    <p>
                        <strong>Doctor:</strong>
                        ${escapeHtml(
                            appointment.doctor_name ||
                            ""
                        )}
                    </p>

                    <p>
                        <strong>Doctor Email:</strong>
                        ${escapeHtml(
                            appointment.doctor_email ||
                            ""
                        )}
                    </p>

                    <p>
                        <strong>Date:</strong>
                        ${formatDate(
                            appointment.appointment_date
                        )}
                    </p>

                    <p>
                        <strong>Time:</strong>
                        ${escapeHtml(
                            displayTime(
                                appointment.appointment_time
                            )
                        )}
                    </p>

                    <p>
                        <strong>Symptoms:</strong>
                        ${escapeHtml(
                            appointment.symptoms ||
                            "None"
                        )}
                    </p>

                    <p>
                        <strong>Status:</strong>

                        <span class="
                            status
                            status-${escapeHtml(status)}
                        ">
                            ${escapeHtml(
                                status.toUpperCase()
                            )}
                        </span>
                    </p>

                `;

                container.appendChild(
                    card
                );

            }
        );

    } catch (error) {

        console.error(
            "Admin appointment error:",
            error
        );

        container.innerHTML =
            "<p>Unable to load appointments.</p>";

    }
}


// =====================================================
// GOOGLE CALENDAR STATUS
// =====================================================

async function checkGoogleCalendarStatus() {

    try {

        const response =
            await fetch(
                "/google-calendar/status",
                {
                    credentials:
                        "include"
                }
            );

        const data =
            await response.json();

        return data;

    } catch (error) {

        console.error(
            "Google Calendar status error:",
            error
        );

        return {

            connected:
                false,

            email:
                null

        };

    }
}


// =====================================================
// GOOGLE CALENDAR CONNECT
// =====================================================

function connectGoogleCalendar() {

    window.location.href =
        "/google-calendar/auth";
}


// =====================================================
// INITIALIZE PAGE
// =====================================================
//
// PATIENT:
//   - Load doctors automatically
//   - Load appointments automatically
//   - Load visit summaries automatically
//   - DO NOT load medications automatically
//
// DOCTOR:
//   - Load doctor appointments automatically
//
// ADMIN:
//   - Load doctors automatically
//
// =====================================================

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        const user =
            getCurrentUser();

        if (!user) {

            return;
        }


        // =============================================
        // PATIENT
        // =============================================

        if (
            user.role ===
            "patient"
        ) {

            const patientName =
                document.getElementById(
                    "patientName"
                );

            const patientEmail =
                document.getElementById(
                    "patientEmail"
                );

            const welcomeTitle =
                document.getElementById(
                    "welcomeTitle"
                );

            if (patientName) {

                patientName.textContent =
                    user.name;

            }

            if (patientEmail) {

                patientEmail.textContent =
                    user.email;

            }

            if (welcomeTitle) {

                welcomeTitle.textContent =
                    `Welcome ${user.name}`;

            }


            // Automatically load:
            // 1. Doctors
            // 2. Patient appointments
            // 3. Visit summaries

            await loadDoctors();

            await loadPatientAppointments();

            await loadVisitSummaries();


            // IMPORTANT:
            // loadMedications() is NOT called here.
            //
            // The medication section stays:
            // "Click the button to load your medications."
            //
            // It loads only when this HTML button is clicked:
            //
            // <button onclick="loadMedications()">
            //     Load Medications
            // </button>

        }


        // =============================================
        // DOCTOR
        // =============================================

        else if (
            user.role ===
            "doctor"
        ) {

            const doctorName =
                document.getElementById(
                    "doctorName"
                );

            if (doctorName) {

                doctorName.textContent =
                    user.name;

            }

            await loadDoctorAppointments();

        }


        // =============================================
        // ADMIN
        // =============================================

        else if (
            user.role ===
            "admin"
        ) {

            const adminName =
                document.getElementById(
                    "adminName"
                );

            if (adminName) {

                adminName.textContent =
                    user.name;

            }

            await loadDoctors();

        }

    }
);