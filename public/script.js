let currentUser = null;


// =====================================================
// REGISTER
// =====================================================

async function register() {

    const name =
        document.getElementById("registerName").value.trim();

    const email =
        document.getElementById("registerEmail").value.trim();

    const password =
        document.getElementById("registerPassword").value;

    const role =
        document.getElementById("registerRole").value;

    const message =
        document.getElementById("registerMessage");


    if (!name || !email || !password || !role) {

        message.textContent =
            "Please fill all fields.";

        return;
    }


    try {

        const response =
            await fetch("/users", {

                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    name,
                    email,
                    password,
                    role
                })
            });


        const data =
            await response.json();


        message.textContent =
            data.message || data.error;


    } catch (error) {

        console.error(error);

        message.textContent =
            "Server error.";
    }
}


// =====================================================
// LOGIN
// =====================================================

async function login() {

    const email =
        document.getElementById("loginEmail").value.trim();

    const password =
        document.getElementById("loginPassword").value;

    const message =
        document.getElementById("loginMessage");


    if (!email || !password) {

        message.textContent =
            "Enter email and password.";

        return;
    }


    try {

        const response =
            await fetch("/login", {

                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    email,
                    password
                })
            });


        const data =
            await response.json();


        if (!response.ok) {

            message.textContent =
                data.error || "Login failed.";

            return;
        }


        if (data.user) {

            currentUser =
                data.user;


            localStorage.setItem(
                "healthUser",
                JSON.stringify(data.user)
            );


            message.textContent =
                `Welcome ${data.user.name}! Role: ${data.user.role}`;


            setTimeout(() => {

                if (data.user.role === "patient") {

                    window.location.href =
                        "/patient.html";

                } else if (data.user.role === "doctor") {

                    window.location.href =
                        "/doctor.html";

                } else if (data.user.role === "admin") {

                    window.location.href =
                        "/admin.html";
                }

            }, 500);
        }


    } catch (error) {

        console.error(error);

        message.textContent =
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
// GET CURRENT USER
// =====================================================

function getCurrentUser() {

    const savedUser =
        localStorage.getItem("healthUser");


    if (savedUser) {

        try {

            currentUser =
                JSON.parse(savedUser);

            return currentUser;

        } catch (error) {

            console.error(error);

            localStorage.removeItem(
                "healthUser"
            );

            currentUser = null;
        }
    }


    return null;
}


// =====================================================
// LOAD DOCTORS
// =====================================================

async function loadDoctors() {

    const select =
        document.getElementById("doctorId");


    if (!select) {
        return;
    }


    try {

        const response =
            await fetch("/doctors");


        const doctors =
            await response.json();


        if (!response.ok) {

            select.innerHTML =
                `<option value="">
                    Unable to load doctors
                </option>`;

            return;
        }


        select.innerHTML =
            `<option value="">
                Select Doctor
            </option>`;


        doctors.forEach(doctor => {

            const option =
                document.createElement("option");


            option.value =
                doctor.id;


            option.textContent =
                `${doctor.name} - ${doctor.specialisation}`;


            select.appendChild(option);

        });


    } catch (error) {

        console.error(
            "Doctor loading error:",
            error
        );

        select.innerHTML =
            `<option value="">
                Unable to load doctors
            </option>`;
    }
}


// =====================================================
// LOAD AVAILABLE SLOTS
// =====================================================

async function loadAvailableSlots() {

    const doctorElement =
        document.getElementById("doctorId");

    const dateElement =
        document.getElementById("appointmentDate");

    const slotsContainer =
        document.getElementById("availableSlots");

    const timeInput =
        document.getElementById("appointmentTime");


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


    timeInput.value = "";


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
                `/doctors/${doctorId}/slots?date=${date}`
            );


        const data =
            await response.json();


        if (!response.ok) {

            slotsContainer.innerHTML =
                `<p>${data.error || "Unable to load slots."}</p>`;

            return;
        }


        if (!data.available) {

            slotsContainer.innerHTML =
                `<p>${data.message}</p>`;

            return;
        }


        if (
            !data.slots ||
            data.slots.length === 0
        ) {

            slotsContainer.innerHTML =
                "<p>No available slots for this date.</p>";

            return;
        }


        slotsContainer.innerHTML = "";


        data.slots.forEach(slot => {

            const button =
                document.createElement("button");


            button.type =
                "button";


            button.textContent =
                slot;


            button.className =
                "slot-button";


            button.addEventListener(
                "click",
                () => {

                    document
                        .querySelectorAll(".slot-button")
                        .forEach(btn => {

                            btn.classList.remove(
                                "selected-slot"
                            );

                        });


                    button.classList.add(
                        "selected-slot"
                    );


                    timeInput.value =
                        slot;
                }
            );


            slotsContainer.appendChild(button);

        });


    } catch (error) {

        console.error(error);

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


    if (!user) {

        message.textContent =
            "Please login first.";

        return;
    }


    if (user.role !== "patient") {

        message.textContent =
            "Only patients can book appointments.";

        return;
    }


    const doctorId =
        document.getElementById(
            "doctorId"
        ).value;


    const appointmentDate =
        document.getElementById(
            "appointmentDate"
        ).value;


    const appointmentTime =
        document.getElementById(
            "appointmentTime"
        ).value;


    const symptoms =
        document.getElementById(
            "symptoms"
        ).value.trim();


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

                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({

                        patient_id:
                            user.id,

                        doctor_id:
                            Number(doctorId),

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


        message.textContent =
            data.message;


        document.getElementById(
            "symptoms"
        ).value = "";


        await loadAvailableSlots();

        await loadPatientAppointments();


    } catch (error) {

        console.error(error);

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


    if (!user || user.role !== "patient") {

        container.innerHTML =
            "<p>Please login as a patient.</p>";

        return;
    }


    container.innerHTML =
        "<p>Loading appointments...</p>";


    try {

        const response =
            await fetch(
                `/appointments/patient/${user.id}`
            );


        const appointments =
            await response.json();


        if (!response.ok) {

            container.innerHTML =
                `<p>${appointments.error || "Unable to load appointments."}</p>`;

            return;
        }


        if (
            !appointments ||
            appointments.length === 0
        ) {

            container.innerHTML =
                "<p>No appointments found.</p>";

            return;
        }


        container.innerHTML = "";


        appointments.forEach(
            (appointment, index) => {

                const card =
                    document.createElement("div");


                card.className =
                    "appointment-card";


                card.innerHTML = `

                    <h3>
                        Appointment #${index + 1}
                    </h3>

                    <p>
                        <strong>Doctor:</strong>
                        ${appointment.doctor_name}
                    </p>

                    <p>
                        <strong>Doctor Email:</strong>
                        ${appointment.doctor_email}
                    </p>

                    <p>
                        <strong>Date:</strong>
                        ${formatDate(
                            appointment.appointment_date
                        )}
                    </p>

                    <p>
                        <strong>Time:</strong>
                        ${appointment.appointment_time}
                    </p>

                    <p>
                        <strong>Symptoms:</strong>
                        ${appointment.symptoms || "None"}
                    </p>

                    <p>
                        <strong>Status:</strong>
                        ${appointment.status.toUpperCase()}
                    </p>
                `;


                container.appendChild(card);

            }
        );


    } catch (error) {

        console.error(error);

        container.innerHTML =
            "<p>Unable to load appointments.</p>";
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


    if (!user || user.role !== "patient") {

        container.innerHTML =
            "<p>Please login as a patient.</p>";

        return;
    }


    container.innerHTML =
        "<p>Loading visit summaries...</p>";


    try {

        const response =
            await fetch(
                `/visit-summaries/${user.id}`
            );


        const summaries =
            await response.json();


        if (!response.ok) {

            container.innerHTML =
                `<p>${summaries.error || "Unable to load summaries."}</p>`;

            return;
        }


        if (
            !summaries ||
            summaries.length === 0
        ) {

            container.innerHTML =
                "<p>No completed visits yet.</p>";

            return;
        }


        container.innerHTML = "";


        summaries.forEach(
            (summary, index) => {

                const card =
                    document.createElement("div");


                card.className =
                    "visit-summary-card";


                card.innerHTML = `

                    <h3>
                        Visit Summary #${index + 1}
                    </h3>

                    <p>
                        <strong>Doctor:</strong>
                        ${summary.doctor_name}
                    </p>

                    <p>
                        <strong>Date:</strong>
                        ${formatDate(
                            summary.appointment_date
                        )}
                    </p>

                    <p>
                        <strong>Time:</strong>
                        ${summary.appointment_time}
                    </p>

                    <p>
                        <strong>Symptoms:</strong>
                        ${summary.symptoms || "None"}
                    </p>

                    <h4>
                        Patient-Friendly Visit Summary
                    </h4>

                    <p>
                        ${summary.visit_summary || "No summary available."}
                    </p>

                    <p>
                        <strong>Prescription:</strong>
                        ${summary.prescription || "No prescription provided."}
                    </p>
                `;


                container.appendChild(card);

            }
        );


    } catch (error) {

        console.error(error);

        container.innerHTML =
            "<p>Unable to load visit summaries.</p>";
    }
}


// =====================================================
// DATE FORMAT
// =====================================================

function formatDate(date) {

    if (!date) {
        return "";
    }


    const d =
        new Date(date);


    if (isNaN(d.getTime())) {
        return date;
    }


    return d.toLocaleDateString("en-GB");
}


// =====================================================
// LOAD DOCTOR APPOINTMENTS
// =====================================================

async function loadDoctorAppointments() {

    const user =
        getCurrentUser();


    const container =
        document.getElementById(
            "appointmentsList"
        );


    if (!container) {
        return;
    }


    if (!user) {

        container.innerHTML =
            "<p>Please login first.</p>";

        return;
    }


    if (user.role !== "doctor") {

        container.innerHTML =
            "<p>Only doctors can view doctor appointments.</p>";

        return;
    }


    container.innerHTML =
        "<p>Loading appointments...</p>";


    try {

        const response =
            await fetch(
                `/appointments/doctor/${user.id}`
            );


        const appointments =
            await response.json();


        if (!response.ok) {

            container.innerHTML =
                `<p>${appointments.error || "Unable to load appointments."}</p>`;

            return;
        }


        if (
            !appointments ||
            appointments.length === 0
        ) {

            container.innerHTML =
                "<p>No appointments found.</p>";

            return;
        }


        container.innerHTML = "";


        appointments.forEach(
            (appointment, index) => {

                const card =
                    document.createElement("div");


                card.className =
                    "appointment-card";


                card.innerHTML = `

                    <h3>
                        Appointment #${index + 1}
                    </h3>

                    <p>
                        <strong>Patient:</strong>
                        ${appointment.patient_name}
                    </p>

                    <p>
                        <strong>Patient Email:</strong>
                        ${appointment.patient_email}
                    </p>

                    <p>
                        <strong>Date:</strong>
                        ${formatDate(
                            appointment.appointment_date
                        )}
                    </p>

                    <p>
                        <strong>Time:</strong>
                        ${appointment.appointment_time}
                    </p>

                    <p>
                        <strong>Symptoms:</strong>
                        ${appointment.symptoms || "None"}
                    </p>

                    <p>
                        <strong>Status:</strong>
                        ${appointment.status.toUpperCase()}
                    </p>


                    ${
                        appointment.status === "pending"
                        ? `

                            <button
                                type="button"
                                onclick="acceptAppointment(${appointment.id})"
                            >
                                Accept
                            </button>

                            <button
                                type="button"
                                onclick="rejectAppointment(${appointment.id})"
                            >
                                Reject
                            </button>

                        `
                        : ""
                    }


                    ${
                        appointment.status === "accepted"
                        ? `

                            <div class="form-box">

                                <h4>
                                    Complete Appointment
                                </h4>

                                <label>
                                    Doctor Notes
                                </label>

                                <textarea
                                    id="notes-${appointment.id}"
                                    placeholder="Enter doctor notes"
                                ></textarea>

                                <label>
                                    Prescription
                                </label>

                                <textarea
                                    id="prescription-${appointment.id}"
                                    placeholder="Enter prescription"
                                ></textarea>

                                <button
                                    type="button"
                                    onclick="completeAppointment(${appointment.id})"
                                >
                                    Complete Appointment
                                </button>

                            </div>

                        `
                        : ""
                    }

                `;


                container.appendChild(card);

            }
        );


    } catch (error) {

        console.error(
            "Doctor appointments error:",
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

    try {

        const response =
            await fetch(
                `/appointments/${id}/accept`,
                {
                    method: "PUT"
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


        alert(data.message);

        await loadDoctorAppointments();


    } catch (error) {

        console.error(error);

        alert(
            "Server error while accepting appointment."
        );
    }
}


// =====================================================
// REJECT APPOINTMENT
// =====================================================

async function rejectAppointment(id) {

    try {

        const response =
            await fetch(
                `/appointments/${id}/reject`,
                {
                    method: "PUT"
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


        alert(data.message);

        await loadDoctorAppointments();


    } catch (error) {

        console.error(error);

        alert(
            "Server error while rejecting appointment."
        );
    }
}


// =====================================================
// COMPLETE APPOINTMENT
// =====================================================

async function completeAppointment(id) {

    const notesElement =
        document.getElementById(
            `notes-${id}`
        );


    const prescriptionElement =
        document.getElementById(
            `prescription-${id}`
        );


    const doctor_notes =
        notesElement
            ? notesElement.value.trim()
            : "";


    const prescription =
        prescriptionElement
            ? prescriptionElement.value.trim()
            : "";


    try {

        const response =
            await fetch(
                `/appointments/${id}/complete`,
                {

                    method: "PUT",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({

                        doctor_notes:
                            doctor_notes,

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


        alert(data.message);

        await loadDoctorAppointments();


    } catch (error) {

        console.error(error);

        alert(
            "Server error while completing appointment."
        );
    }
}


// =====================================================
// INITIALIZE PAGE
// =====================================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        getCurrentUser();

        // Patient page
        loadDoctors();
        loadPatientAppointments();
        loadVisitSummaries();

    }
);