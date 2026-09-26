/* ==========================================
   HEALTHGUARD AI - COMPREHENSIVE CLINICAL CLIENT
========================================== */

let currentCalendarDate = new Date();
let lastAiData = null;
let activeUserSymptoms = [];
let speechSynthUtterance = null;
let bookedAppointmentsCache = [];

/* ==========================================
   INITIALIZATION & UI LOGIC
========================================== */
window.addEventListener('load', () => {
    setTimeout(() => {
        const loader = document.getElementById('globalLoader');
        if (loader) {
            loader.style.opacity = '0';
            setTimeout(() => loader.style.display = 'none', 500);
        }
    }, 1200);

    initTheme();
    loadRandomTip();
    loadChatHistory();
    initFirstAid();
});

function initTheme() {
    const saved = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
    const icon = document.getElementById('themeIcon');
    if (icon) icon.className = saved === 'dark' ? 'ri-sun-line' : 'ri-moon-line';
}

function toggleTheme() {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    const icon = document.getElementById('themeIcon');
    if (icon) icon.className = next === 'dark' ? 'ri-sun-line' : 'ri-moon-line';
}

/* FIREBASE CONFIG & AUTH */
const firebaseConfig = { 
    apiKey: "AIzaSyCBrvo4Z_d6IqiV5Or7kpnBuXAJmEyT7ik", 
    authDomain: "healthguard-ai-22.firebaseapp.com", 
    projectId: "healthguard-ai-22" 
};
if (window.firebase && !firebase.apps.length) firebase.initializeApp(firebaseConfig);

function loginUser() { 
    // Guest / Quick access fallback for local dev or offline
    handleUserAuth({ 
        displayName: "John Doe", 
        email: "patient@healthguard.ai", 
        photoURL: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80" 
    }); 
}

function googleLogin() {
    if (window.firebase && firebase.auth) {
        firebase.auth().signInWithPopup(new firebase.auth.GoogleAuthProvider())
            .then(result => handleUserAuth(result.user))
            .catch(err => {
                console.warn("Google Sign-In failed, falling back to demo session:", err);
                loginUser();
            });
    } else {
        loginUser();
    }
}

if (window.firebase && firebase.auth) {
    firebase.auth().onAuthStateChanged(user => { if(user) handleUserAuth(user); });
}

function handleUserAuth(user) {
    document.getElementById("loginPage").style.display = "none";
    document.getElementById("appWrapper").style.display = "flex";
    const profBottom = document.querySelector(".profile-bottom");
    if(profBottom) profBottom.style.display = "flex";

    if(document.getElementById("userName")) document.getElementById("userName").innerText = user.displayName || "Patient";
    if(document.getElementById("userPhoto")) document.getElementById("userPhoto").src = user.photoURL || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80";
    if(document.getElementById("dashWelcomeName")) document.getElementById("dashWelcomeName").innerText = (user.displayName || "User").split(" ")[0];
    if(document.getElementById("settingsName")) document.getElementById("settingsName").innerHTML = "<i class='ri-user-line'></i> " + (user.displayName || "Patient");
    if(document.getElementById("settingsEmail")) document.getElementById("settingsEmail").innerHTML = "<i class='ri-mail-line'></i> " + (user.email || "patient@healthguard.ai");

    showSection('main');
    startClock();
    loadDashboardData();
}

function logout() { 
    if(window.firebase && firebase.auth) {
        firebase.auth().signOut().then(() => location.reload());
    } else {
        location.reload();
    }
}

function toggleProfileMenu() {
    const m = document.getElementById("profileMenu");
    if(m) m.style.display = m.style.display === "block" ? "none" : "block";
}

/* NAVIGATION */
function showSection(s) {
    const sections = [
        'mainApp', 'vitalsSection', 'medsSection', 'appointmentsSection', 
        'historySection', 'dashboardSection', 'settingsSection', 
        'feedbackSection', 'aboutSection', 'calendarSection'
    ];
    
    sections.forEach(id => {
        let el = document.getElementById(id);
        if (el) el.style.display = "none";
    });

    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    let activeBtn = document.querySelector(`.nav-menu button[onclick*="${s}"]`);
    if (activeBtn) activeBtn.classList.add('active');

    if(s === "main") document.getElementById("mainApp").style.display = "block";
    if(s === "vitals") { document.getElementById("vitalsSection").style.display = "block"; loadVitalsHistory(); }
    if(s === "meds") { document.getElementById("medsSection").style.display = "block"; loadMedications(); }
    if(s === "appointments") { document.getElementById("appointmentsSection").style.display = "block"; loadAppointments(); }
    if(s === "history") { document.getElementById("historySection").style.display = "block"; loadHistoryBackend(); }
    if(s === "dashboard") { document.getElementById("dashboardSection").style.display = "block"; loadDashboardData(); }
    if(s === "calendar") { document.getElementById("calendarSection").style.display = "block"; renderCalendar(currentCalendarDate); }
    if(s === "settings") document.getElementById("settingsSection").style.display = "block";
    if(s === "feedback") document.getElementById("feedbackSection").style.display = "block";
    if(s === "about") document.getElementById("aboutSection").style.display = "block";

    window.scrollTo({ top: 0, behavior: 'smooth' });
}


/* ==========================================
   FEATURE 1: CLINICAL QUICK SYMPTOM HELPER
========================================== */
function fillQuickSymptom(text) {
    const queryEl = document.getElementById("query");
    if (!queryEl) return;
    if (queryEl.value.trim().length > 0) {
        queryEl.value = queryEl.value.trim() + ", " + text;
    } else {
        queryEl.value = text;
    }
    queryEl.focus();
    // Smooth pulse visual feedback on textarea
    queryEl.style.borderColor = "var(--primary-light)";
    setTimeout(() => {
        queryEl.style.borderColor = "";
    }, 600);
}

function clearSymptomsInput() {
    activeUserSymptoms = [];
    const q = document.getElementById("query");
    if (q) q.value = "";
    const res = document.getElementById("response");
    if (res) res.innerHTML = "";
}


/* ==========================================
   FEATURE 2: VOICE DICTATION & AUDIO READOUT
========================================== */
let recognition = null;
let isRecording = false;

function startVoice() {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
        return alert("Speech Recognition is not supported by your browser. Please try in Google Chrome or Microsoft Edge.");
    }

    const voiceBtn = document.getElementById("voiceBtn");
    const indicator = document.getElementById("voiceIndicator");
    const statusText = document.getElementById("voiceStatusText");
    const queryEl = document.getElementById("query");

    if (isRecording && recognition) {
        recognition.stop();
        return;
    }

    recognition = new SpeechRec();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
        isRecording = true;
        if (voiceBtn) voiceBtn.classList.add("recording");
        if (indicator) indicator.style.display = "flex";
        if (statusText) statusText.innerText = "Listening... Speak your symptoms clearly";
    };

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        if (queryEl) {
            queryEl.value = (queryEl.value ? queryEl.value.trim() + " " : "") + transcript;
        }
    };

    recognition.onerror = (event) => {
        console.error("Voice Error:", event.error);
        if (statusText) statusText.innerText = "Voice error: " + event.error;
        setTimeout(() => { if (indicator) indicator.style.display = "none"; }, 2000);
    };

    recognition.onend = () => {
        isRecording = false;
        if (voiceBtn) voiceBtn.classList.remove("recording");
        if (indicator) indicator.style.display = "none";
    };

    recognition.start();
}

function toggleSpeakDiagnosis() {
    if (!window.speechSynthesis) return alert("Speech Synthesis is not supported in this browser.");

    const ttsBtn = document.getElementById("ttsBtn");
    const ttsText = document.getElementById("ttsBtnText");
    const ttsIcon = document.getElementById("ttsIcon");

    if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
        if (ttsText) ttsText.innerText = "Listen to Analysis";
        if (ttsIcon) ttsIcon.className = "ri-volume-up-line";
        return;
    }

    if (!lastAiData) return alert("No diagnostic analysis available to speak yet.");

    const mainDisease = lastAiData.diseases && lastAiData.diseases[0] ? lastAiData.diseases[0].name : "Health Condition";
    const script = `Medical assessment for ${mainDisease}. ${lastAiData.explanation}. Predicted causes include: ${lastAiData.causes.join(", ")}. Recommended recovery timeline is ${lastAiData.recovery}. Recommended specialist is ${lastAiData.specialist}. Please follow dietary advice and consult a qualified healthcare provider.`;

    speechSynthUtterance = new SpeechSynthesisUtterance(script);
    speechSynthUtterance.rate = 0.95;
    speechSynthUtterance.pitch = 1.0;

    speechSynthUtterance.onstart = () => {
        if (ttsText) ttsText.innerText = "Stop Audio";
        if (ttsIcon) ttsIcon.className = "ri-volume-mute-line text-danger";
    };

    speechSynthUtterance.onend = () => {
        if (ttsText) ttsText.innerText = "Listen to Analysis";
        if (ttsIcon) ttsIcon.className = "ri-volume-up-line";
    };

    speechSynthUtterance.onerror = () => {
        if (ttsText) ttsText.innerText = "Listen to Analysis";
        if (ttsIcon) ttsIcon.className = "ri-volume-up-line";
    };

    window.speechSynthesis.speak(speechSynthUtterance);
}


/* ==========================================
   FEATURE 3: VITALS TRACKER & BIOMARKERS
========================================== */
function calculateLiveBMI() {
    const weight = parseFloat(document.getElementById("vitalsWeight").value);
    const height = parseFloat(document.getElementById("vitalsHeight").value);
    const bmiValEl = document.getElementById("calculatedBmiVal");
    const bmiBadge = document.getElementById("bmiBadge");

    if (!weight || !height || height <= 0) return;

    const heightM = height / 100;
    const bmi = (weight / (heightM * heightM)).toFixed(1);

    let category = "Normal Weight";
    let colorClass = "vital-normal";
    if (bmi < 18.5) { category = "Underweight"; colorClass = "vital-warning"; }
    else if (bmi >= 25 && bmi < 29.9) { category = "Overweight"; colorClass = "vital-warning"; }
    else if (bmi >= 30) { category = "Obese"; colorClass = "vital-danger"; }

    if (bmiValEl) bmiValEl.innerText = `${bmi} (${category})`;
    if (bmiBadge) {
        bmiBadge.innerText = `BMI: ${bmi}`;
        bmiBadge.className = `vital-badge ${colorClass}`;
    }
}

function evaluateVitalsBadges() {
    // Blood Pressure
    const sys = parseInt(document.getElementById("vitalsSystolic").value);
    const dia = parseInt(document.getElementById("vitalsDiastolic").value);
    const bpBadge = document.getElementById("bpBadge");

    if (sys && dia && bpBadge) {
        if (sys > 180 || dia > 120) {
            bpBadge.innerText = "Crisis (>180)";
            bpBadge.className = "vital-badge vital-danger";
        } else if (sys >= 140 || dia >= 90) {
            bpBadge.innerText = "Stage 2 HTN";
            bpBadge.className = "vital-badge vital-danger";
        } else if (sys >= 130 || dia >= 80) {
            bpBadge.innerText = "Stage 1 HTN";
            bpBadge.className = "vital-badge vital-warning";
        } else if (sys >= 120 && sys <= 129 && dia < 80) {
            bpBadge.innerText = "Elevated";
            bpBadge.className = "vital-badge vital-warning";
        } else {
            bpBadge.innerText = "Normal";
            bpBadge.className = "vital-badge vital-normal";
        }
    }

    // Glucose
    const glu = parseInt(document.getElementById("vitalsGlucose").value);
    const gluBadge = document.getElementById("glucoseBadge");
    if (glu && gluBadge) {
        if (glu >= 126) {
            gluBadge.innerText = "High (>=126)";
            gluBadge.className = "vital-badge vital-danger";
        } else if (glu >= 100) {
            gluBadge.innerText = "Pre-Diabetic";
            gluBadge.className = "vital-badge vital-warning";
        } else if (glu < 70) {
            gluBadge.innerText = "Low (<70)";
            gluBadge.className = "vital-badge vital-warning";
        } else {
            gluBadge.innerText = "Normal";
            gluBadge.className = "vital-badge vital-normal";
        }
    }

    // HR & SpO2
    const hr = parseInt(document.getElementById("vitalsHR").value);
    const spo2 = parseInt(document.getElementById("vitalsSpO2").value);
    const pulseBadge = document.getElementById("pulseBadge");
    if ((hr || spo2) && pulseBadge) {
        if (spo2 && spo2 < 94) {
            pulseBadge.innerText = "Low Oxygen!";
            pulseBadge.className = "vital-badge vital-danger";
        } else if (hr && (hr > 100 || hr < 55)) {
            pulseBadge.innerText = "Abnormal HR";
            pulseBadge.className = "vital-badge vital-warning";
        } else {
            pulseBadge.innerText = "Optimal";
            pulseBadge.className = "vital-badge vital-normal";
        }
    }
}

function saveVitals() {
    const sys = parseInt(document.getElementById("vitalsSystolic").value) || null;
    const dia = parseInt(document.getElementById("vitalsDiastolic").value) || null;
    const glu = parseInt(document.getElementById("vitalsGlucose").value) || null;
    const hr = parseInt(document.getElementById("vitalsHR").value) || null;
    const spo2 = parseInt(document.getElementById("vitalsSpO2").value) || null;
    const weight = parseFloat(document.getElementById("vitalsWeight").value) || null;
    const height = parseFloat(document.getElementById("vitalsHeight").value) || null;
    const notes = document.getElementById("vitalsNotes").value.trim();

    if (!sys && !glu && !hr && !weight) {
        return alert("Please enter at least one biomarker (BP, Glucose, Heart Rate, or Weight) to log vitals.");
    }

    let bmi = null;
    if (weight && height) {
        bmi = parseFloat((weight / ((height / 100) ** 2)).toFixed(1));
    }

    let category = "Normal";
    if (sys && sys >= 140) category = "Hypertension";
    if (glu && glu >= 126) category = "Hyperglycemia";
    if (spo2 && spo2 < 94) category = "Hypoxia";

    const payload = {
        systolic: sys,
        diastolic: dia,
        glucose: glu,
        heart_rate: hr,
        spo2: spo2,
        weight: weight,
        height: height,
        bmi: bmi,
        category: category,
        notes: notes
    };

    fetch("/vitals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    })
    .then(r => r.json())
    .then(data => {
        document.getElementById("vitalsStatus").innerHTML = `<span class="text-success"><i class="ri-check-line"></i> Vitals recorded successfully!</span>`;
        setTimeout(() => { document.getElementById("vitalsStatus").innerHTML = ""; }, 3000);
        loadVitalsHistory();
        loadDashboardData();
    })
    .catch(err => alert("Error saving vitals."));
}

function loadVitalsHistory() {
    fetch("/vitals")
        .then(r => r.json())
        .then(data => {
            const tbody = document.getElementById("vitalsTableBody");
            if (!tbody) return;

            if (!data || data.length === 0) {
                tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted">No vitals logged yet. Use the form above to log your first entry.</td></tr>`;
                return;
            }

            tbody.innerHTML = data.map(v => {
                const dateStr = new Date(v.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                const bp = (v.systolic && v.diastolic) ? `${v.systolic}/${v.diastolic} mmHg` : '-';
                const glu = v.glucose ? `${v.glucose} mg/dL` : '-';
                const hr = v.heart_rate ? `${v.heart_rate} BPM` : '-';
                const spo2 = v.spo2 ? `${v.spo2}%` : '-';
                const bmi = v.bmi ? v.bmi : '-';

                return `
                    <tr>
                        <td><strong>${dateStr}</strong></td>
                        <td>${bp}</td>
                        <td>${glu}</td>
                        <td>${hr}</td>
                        <td>${spo2}</td>
                        <td>${bmi}</td>
                        <td><span class="vital-badge ${v.category === 'Normal' ? 'vital-normal' : 'vital-warning'}">${v.category}</span></td>
                        <td><button class="icon-btn-small danger-hover" onclick="deleteVitalRecord(${v.id})" title="Delete"><i class="ri-delete-bin-line"></i></button></td>
                    </tr>
                `;
            }).join("");
        });
}

function deleteVitalRecord(id) {
    if (!confirm("Delete this vital record?")) return;
    fetch(`/vitals/${id}`, { method: "DELETE" })
        .then(r => r.json())
        .then(() => {
            loadVitalsHistory();
            loadDashboardData();
        });
}


/* ==========================================
   FEATURE 4: MEDICINE VAULT & DRUG INTERACTIONS
========================================== */
function loadMedications() {
    fetch("/medications")
        .then(r => r.json())
        .then(data => {
            const list = document.getElementById("medicationsList");
            if (!list) return;

            if (!data || data.length === 0) {
                list.innerHTML = `<p class="text-muted">No medications registered yet. Add a prescription on the right.</p>`;
                return;
            }

            list.innerHTML = data.map(m => {
                const isTaken = m.status === 'taken';
                return `
                    <div class="med-item ${isTaken ? 'med-taken' : ''}">
                        <div class="d-flex align-center gap-15">
                            <input type="checkbox" class="med-checkbox" ${isTaken ? 'checked' : ''} onchange="toggleMedStatus(${m.id})">
                            <div>
                                <h4 class="med-name">${m.name} <small class="text-primary">(${m.dosage || 'Standard'})</small></h4>
                                <p class="text-sm text-muted"><i class="ri-time-line"></i> ${m.timing} ${m.notes ? '• ' + m.notes : ''}</p>
                            </div>
                        </div>
                        <div class="d-flex align-center gap-15">
                            <span class="status-pill ${isTaken ? 'status-taken' : 'status-pending'}">${isTaken ? 'Taken' : 'Pending'}</span>
                            <button class="icon-btn-small danger-hover" onclick="deleteMed(${m.id})"><i class="ri-delete-bin-line"></i></button>
                        </div>
                    </div>
                `;
            }).join("");
        });
}

function addNewMedication() {
    const name = document.getElementById("medName").value.trim();
    const dosage = document.getElementById("medDosage").value.trim();
    const timing = document.getElementById("medTiming").value;
    const notes = document.getElementById("medNotes").value.trim();

    if (!name) return alert("Please enter the medication name.");

    fetch("/medications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, dosage, timing, notes })
    })
    .then(r => r.json())
    .then(data => {
        if (data.success) {
            document.getElementById("medName").value = "";
            document.getElementById("medDosage").value = "";
            document.getElementById("medNotes").value = "";
            loadMedications();
            loadDashboardData();
        }
    });
}

function toggleMedStatus(id) {
    fetch(`/medications/${id}/toggle`, { method: "PUT" })
        .then(r => r.json())
        .then(() => loadMedications());
}

function deleteMed(id) {
    if (!confirm("Remove this medication?")) return;
    fetch(`/medications/${id}`, { method: "DELETE" })
        .then(r => r.json())
        .then(() => {
            loadMedications();
            loadDashboardData();
        });
}

function checkCustomDrugInteractions() {
    const input = document.getElementById("drugCheckInput").value.trim();
    if (!input) return alert("Please enter at least 2 medications separated by commas.");
    runDrugInteractionCheck(input);
}

function checkAllCurrentMedInteractions() {
    fetch("/medications")
        .then(r => r.json())
        .then(data => {
            if (!data || data.length < 2) {
                return alert("You need at least 2 medications in your Vault to check interactions. Or type them manually in the checker below.");
            }
            const names = data.map(d => d.name).join(", ");
            const input = document.getElementById("drugCheckInput");
            if (input) input.value = names;
            runDrugInteractionCheck(names);
        });
}

function runDrugInteractionCheck(medString) {
    const resBox = document.getElementById("drugInteractionResult");
    if (!resBox) return;

    resBox.style.display = "block";
    resBox.innerHTML = `<p>⏳ Evaluating pharmacological interactions and contraindications with Gemini AI...</p>`;

    fetch("/check-drug-interactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ medications: medString })
    })
    .then(r => r.json())
    .then(data => {
        const riskColor = data.overall_risk === 'High' ? 'var(--danger)' : data.overall_risk === 'Moderate' ? 'var(--warning)' : 'var(--success)';
        
        let interactionsHTML = "";
        if (data.interactions && data.interactions.length > 0) {
            interactionsHTML = data.interactions.map(item => `
                <div class="interaction-item">
                    <strong><i class="ri-alert-line"></i> ${item.drugs} (${item.severity} Risk):</strong>
                    <p class="text-sm mt-1">${item.description || item.effect}</p>
                </div>
            `).join("");
        } else {
            interactionsHTML = `<p class="text-sm text-success"><i class="ri-check-line"></i> No severe direct drug-drug interactions flagged.</p>`;
        }

        let foodHTML = (data.food_warnings || []).map(f => `<li>${f}</li>`).join("");
        let sidesHTML = (data.side_effects || []).map(s => `<li>${s}</li>`).join("");

        resBox.innerHTML = `
            <div class="d-flex justify-between align-center mb-3">
                <h4><i class="ri-shield-keyhole-line"></i> Clinical Interaction Summary</h4>
                <span class="vital-badge" style="background:${riskColor}; color:white;">Overall Risk: ${data.overall_risk}</span>
            </div>
            <p class="mb-3"><strong>Assessment:</strong> ${data.summary}</p>
            <div class="mb-3">${interactionsHTML}</div>
            <div class="grid-2 gap-15 mt-3">
                <div>
                    <h5 class="text-warning mb-2"><i class="ri-restaurant-line"></i> Dietary & Beverage Precautions:</h5>
                    <ul style="padding-left:20px; font-size:13px;">${foodHTML || '<li>Standard balanced diet.</li>'}</ul>
                </div>
                <div>
                    <h5 class="text-info mb-2"><i class="ri-stethoscope-line"></i> Potential Side Effects:</h5>
                    <ul style="padding-left:20px; font-size:13px;">${sidesHTML || '<li>Monitor general wellness.</li>'}</ul>
                </div>
            </div>
        `;
    })
    .catch(err => {
        resBox.innerHTML = `<p class="text-danger">Failed to check drug interactions. Please verify your connection.</p>`;
    });
}


/* ==========================================
   FEATURE 5: EMERGENCY FIRST-AID GUIDES & SOS
========================================== */
const firstAidProtocols = {
    cpr: {
        title: "Cardiopulmonary Resuscitation (Adult CPR)",
        steps: [
            "Check responsiveness and verify normal breathing (look, listen, feel for max 10 sec).",
            "Call 112 / 108 or have a bystander call emergency services immediately.",
            "Place the heel of one hand in the center of the chest; place other hand on top and interlock fingers.",
            "Deliver 30 chest compressions hard and fast (100–120 compressions/min, at least 2 inches deep).",
            "Tilt head, lift chin, and give 2 rescue breaths (1 second each, watching chest rise).",
            "Repeat cycle of 30 compressions and 2 breaths until medical help or an AED arrives."
        ],
        warning: "Do not interrupt compressions for more than 10 seconds. Push hard and push fast to the beat of 'Stayin' Alive'."
    },
    choking: {
        title: "Heimlich Maneuver (Choking Adult)",
        steps: [
            "Ask: 'Are you choking?' If the person can cough or speak, encourage coughing.",
            "If unable to breathe or make sound, stand behind them and wrap arms around their waist.",
            "Make a fist with one hand and place the thumb side just above the navel, well below the breastbone.",
            "Grasp your fist with your other hand and deliver quick, upward and inward abdominal thrusts.",
            "Continue until the object is expelled or the person becomes unconscious.",
            "If unconscious, lower carefully to the ground and begin CPR immediately."
        ],
        warning: "Never perform blind finger sweeps in the mouth as this may lodge the object deeper."
    },
    stroke: {
        title: "Stroke Identification - F.A.S.T. Protocol",
        steps: [
            "F - FACE: Ask the person to smile. Does one side of the face droop?",
            "A - ARMS: Ask them to raise both arms. Does one arm drift downward?",
            "S - SPEECH: Ask them to repeat a simple sentence. Is their speech slurred or strange?",
            "T - TIME: If you observe any of these signs, call 112/108 IMMEDIATELY.",
            "Note the exact time symptoms first started; clot-busting treatments must be given within a critical window.",
            "Keep patient calm, lying down with head elevated 30 degrees. Do not give food, water, or aspirin."
        ],
        warning: "Do not give aspirin to suspected stroke patients until a hospital CT scan rules out brain hemorrhage."
    },
    burns: {
        title: "Thermal & Scald Burns",
        steps: [
            "Immediately stop the burning process: remove source of heat.",
            "Cool the burn with cool (not ice-cold) running tap water for at least 10 to 20 minutes.",
            "Gently remove jewelry or tight clothing before swelling begins, but DO NOT pull away melted clothing stuck to the burn.",
            "Cover the area loosely with clean plastic cling wrap or sterile non-adherent dressing.",
            "Keep the patient warm to prevent hypothermia.",
            "Seek urgent emergency care for burns larger than the patient's palm, on face/joints, or electrical burns."
        ],
        warning: "NEVER apply ice, butter, toothpaste, or oil to a burn. This traps heat and causes tissue damage."
    },
    bleeding: {
        title: "Severe Bleeding & Hemorrhage Control",
        steps: [
            "Apply direct, firm pressure over the wound using a clean cloth, sterile gauze, or your gloved hands.",
            "Maintain uninterrupted pressure for at least 5-10 minutes without lifting to check.",
            "If blood soaks through, DO NOT remove the dressing; add more cloth on top and press harder.",
            "Elevate the injured limb above heart level if no fracture is suspected.",
            "For life-threatening extremity arterial bleeding that cannot be stopped with pressure, apply a commercial tourniquet 2-3 inches above the wound."
        ],
        warning: "Do not remove large penetrating objects embedded in a wound; stabilize the object with padding around it."
    },
    seizure: {
        title: "Seizure & Convulsion Safety",
        steps: [
            "Stay calm and gently guide the person to the floor away from hard or sharp objects.",
            "Cushion their head with a folded jacket or pillow.",
            "Loosen tight neckwear (ties, collars) and remove eyeglasses.",
            "Turn the person gently onto their side (recovery position) to keep the airway clear.",
            "Time the seizure. Call 112/108 if seizure lasts longer than 5 minutes or repeats."
        ],
        warning: "NEVER hold the person down or put ANY object in their mouth. They cannot swallow their tongue."
    }
};

function initFirstAid() {
    switchFirstAidTab('cpr');
}

function openFirstAidModal() {
    const m = document.getElementById("firstAidModal");
    if (m) m.style.display = "flex";
}

function closeFirstAidModal() {
    const m = document.getElementById("firstAidModal");
    if (m) m.style.display = "none";
}

function switchFirstAidTab(key, event) {
    if (event) {
        document.querySelectorAll('.fa-tab').forEach(t => t.classList.remove('active'));
        event.currentTarget.classList.add('active');
    }

    const proto = firstAidProtocols[key];
    const container = document.getElementById("faContent");
    if (!proto || !container) return;

    let stepsHTML = proto.steps.map((s, i) => `
        <div class="first-aid-step">
            <span class="step-num">${i + 1}</span>
            <p>${s}</p>
        </div>
    `).join("");

    container.innerHTML = `
        <h3 class="mb-2 text-primary">${proto.title}</h3>
        <div class="steps-container mb-3">${stepsHTML}</div>
        <div class="glass-card" style="border-left:4px solid var(--danger); background: rgba(239, 68, 68, 0.1);">
            <strong><i class="ri-alert-fill text-danger"></i> Critical Clinical Caution:</strong>
            <p class="text-sm mt-1">${proto.warning}</p>
        </div>
    `;
}


/* ==========================================
   FEATURE 6: FULL CLINICAL PDF REPORT GENERATOR
========================================== */
function printReport() {
    if (!lastAiData) {
        return alert("Please run a symptom analysis or document scan first before printing a clinical report.");
    }

    // Populate Report Template
    const userName = (document.getElementById("userName") ? document.getElementById("userName").innerText : "Patient");
    const userQuery = document.getElementById("query") ? document.getElementById("query").value : "Symptoms entered";
    
    document.getElementById("printName").innerText = userName;
    document.getElementById("printDate").innerText = new Date().toLocaleString();
    document.getElementById("printReportId").innerText = "HA-" + Math.floor(100000 + Math.random() * 900000);
    document.getElementById("printSymptoms").innerText = userQuery || "Clinical diagnostic input";
    
    const mainDisease = (lastAiData.diseases && lastAiData.diseases[0]) ? lastAiData.diseases[0].name : "Undetermined Condition";
    document.getElementById("printDisease").innerText = mainDisease;
    document.getElementById("printConfidence").innerText = (lastAiData.confidence_score || 90) + "%";
    document.getElementById("printRisk").innerText = (lastAiData.severity || "Moderate") + " / " + (lastAiData.risk_level || "Moderate");
    document.getElementById("printHealthScore").innerText = lastAiData.health_score || 75;

    document.getElementById("printAnalysis").innerText = (lastAiData.explanation || "") + " " + (lastAiData.why || "");
    document.getElementById("printCauses").innerText = (lastAiData.causes || []).join(", ") || "Multiple contributing factors.";
    document.getElementById("printTests").innerText = (lastAiData.tests || []).join(", ") || "Complete Blood Count, Metabolic Panel.";

    if (lastAiData.diet) {
        document.getElementById("printDietEat").innerHTML = (lastAiData.diet.eat || []).map(e => `<li>${e}</li>`).join("");
        document.getElementById("printDietAvoid").innerHTML = (lastAiData.diet.avoid || []).map(a => `<li>${a}</li>`).join("");
        document.getElementById("printLifestyle").innerText = `Water: ${lastAiData.diet.water || '2.5L'}, Sleep: ${lastAiData.diet.sleep || '7-8 hrs'}, Routine: ${lastAiData.diet.exercise || 'Light cardio'}`;
    }

    document.getElementById("printRecovery").innerText = lastAiData.recovery || "3-7 days";
    document.getElementById("printSpecialist").innerText = lastAiData.specialist || "General Physician";

    // Trigger Browser Print / Save to PDF
    window.print();
}


/* ==========================================
   FEATURE 7: DOCTOR APPOINTMENTS & CALENDAR
========================================= */
function openBookingModal() {
    const m = document.getElementById("bookingModal");
    if (!m) return;
    m.style.display = "flex";

    // Pre-fill specialist if available from AI
    if (lastAiData && lastAiData.specialist) {
        const specEl = document.getElementById("bookSpecialty");
        if (specEl) specEl.value = lastAiData.specialist;
    }

    // Pre-fill tomorrow's date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];
    const dateEl = document.getElementById("bookDate");
    if (dateEl && !dateEl.value) dateEl.value = dateStr;
}

function closeBookingModal() {
    const m = document.getElementById("bookingModal");
    if (m) m.style.display = "none";
}

function submitAppointment() {
    const specialty = document.getElementById("bookSpecialty").value.trim() || "General Medicine";
    const doctor = document.getElementById("bookDoctor").value.trim() || "Dr. Medical Specialist";
    const hospital = document.getElementById("bookHospital").value.trim() || "City Multispeciality Hospital";
    const appt_date = document.getElementById("bookDate").value;
    const appt_time = document.getElementById("bookTime").value || "10:00 AM";
    const notes = document.getElementById("bookNotes").value.trim();

    if (!appt_date) return alert("Please choose an appointment date.");

    fetch("/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            specialty,
            doctor_name: doctor,
            hospital,
            appt_date,
            appt_time,
            notes
        })
    })
    .then(r => r.json())
    .then(data => {
        closeBookingModal();
        alert("Consultation scheduled! Synced with your Health Calendar.");
        loadAppointments();
        renderCalendar(currentCalendarDate);
        loadDashboardData();
    });
}

function loadAppointments() {
    fetch("/appointments")
        .then(r => r.json())
        .then(data => {
            bookedAppointmentsCache = data || [];
            const list = document.getElementById("appointmentsList");
            if (!list) return;

            if (!data || data.length === 0) {
                list.innerHTML = `<p class="text-muted">No consultations scheduled yet. Book an appointment using the button above.</p>`;
                return;
            }

            list.innerHTML = data.map(a => {
                return `
                    <div class="appointment-card glass-card">
                        <div class="d-flex justify-between align-center mb-2">
                            <h4 class="text-primary"><i class="ri-user-star-line"></i> ${a.doctor_name}</h4>
                            <span class="status-pill status-taken">${a.specialty}</span>
                        </div>
                        <p class="text-sm"><i class="ri-hospital-line text-muted"></i> ${a.hospital}</p>
                        <p class="text-sm"><i class="ri-calendar-event-line text-warning"></i> <strong>${a.appt_date}</strong> at ${a.appt_time}</p>
                        ${a.notes ? `<p class="text-xs text-muted mt-2">Notes: ${a.notes}</p>` : ''}
                        <div class="d-flex justify-between align-center mt-3">
                            <button class="action-btn-sm" onclick="deleteAppointmentRecord(${a.id})"><i class="ri-close-line"></i> Cancel</button>
                            <span class="text-xs text-success"><i class="ri-check-line"></i> Confirmed</span>
                        </div>
                    </div>
                `;
            }).join("");
        });
}

function deleteAppointmentRecord(id) {
    if (!confirm("Cancel this appointment?")) return;
    fetch(`/appointments/${id}`, { method: "DELETE" })
        .then(r => r.json())
        .then(() => {
            loadAppointments();
            renderCalendar(currentCalendarDate);
            loadDashboardData();
        });
}

/* ==========================================
   CALENDAR UTILITIES WITH REAL EVENTS
========================================== */
function renderCalendar(date) {
    const monthYearTitle = document.getElementById("calMonthYearTitle");
    const gridDaysContainer = document.getElementById("calendarGridDays");
    if (!gridDaysContainer || !monthYearTitle) return;

    const year = date.getFullYear();
    const month = date.getMonth();
    const monthsNameArray = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    monthYearTitle.innerText = `${monthsNameArray[month]} ${year}`;

    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();

    let gridHTML = `
        <div class="cal-day head">S</div><div class="cal-day head">M</div><div class="cal-day head">T</div>
        <div class="cal-day head">W</div><div class="cal-day head">T</div><div class="cal-day head">F</div>
        <div class="cal-day head">S</div>
    `;

    for (let i = 0; i < firstDayIndex; i++) gridHTML += `<div class="cal-day empty"></div>`;

    const realToday = new Date();
    
    // Check appointments for each day in this month
    fetch("/appointments")
        .then(r => r.json())
        .then(appts => {
            bookedAppointmentsCache = appts || [];
            buildCalendarCells();
        })
        .catch(() => buildCalendarCells());

    function buildCalendarCells() {
        let cells = gridHTML;
        for (let day = 1; day <= totalDaysInMonth; day++) {
            const isToday = (year === realToday.getFullYear() && month === realToday.getMonth() && day === realToday.getDate());
            const monthPadded = String(month + 1).padStart(2, '0');
            const dayPadded = String(day).padStart(2, '0');
            const dateKey = `${year}-${monthPadded}-${dayPadded}`;

            const hasAppt = bookedAppointmentsCache.some(a => a.appt_date === dateKey);
            const hasMockLog = (day % 4 === 0);

            let dots = "";
            if (hasAppt) dots += `<div class="event-dot appt-dot" title="Doctor Appointment"></div>`;
            else if (hasMockLog) dots += `<div class="event-dot log-dot" title="Health Record Logged"></div>`;

            cells += `<div class="cal-day ${isToday ? 'active' : ''}">${day}${dots}</div>`;
        }
        gridDaysContainer.innerHTML = cells;
    }
}

function changeMonth(direction) {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + direction);
    renderCalendar(currentCalendarDate);
}


/* ==========================================
   CORE PREDICTION & OCR LOGIC
========================================== */
document.getElementById("reportFile").addEventListener("change", function () {
    if (this.files.length > 0) document.getElementById("fileName").innerHTML = `<i class="ri-file-text-line"></i> ${this.files[0].name}`;
});

function uploadReport() {
    let fileInput = document.getElementById("reportFile");
    if (!fileInput.files.length) return alert("Upload a report first.");
    let formData = new FormData();
    formData.append("file", fileInput.files[0]);
    document.getElementById("response").innerHTML = "<p>⏳ Extracting OCR text and analyzing clinical findings...</p>";

    fetch("/upload-report", { method: "POST", body: formData })
    .then(res => res.json())
    .then(data => {
        if(data.error) throw new Error(data.error);
        handleAdvancedJSONResponse(data);
        refreshAppData();
    })
    .catch(err => document.getElementById("response").innerHTML = "<p style='color:red;'>Error analyzing document.</p>");
}

function askAI() {
    let query = document.getElementById("query").value.trim();
    if (!query) return alert("Please enter or select symptoms first.");

    const urgentKeywords = ['chest pain', 'stroke', 'difficulty breathing', 'heart attack', 'unconscious', 'severe bleeding'];
    if (urgentKeywords.some(kw => query.toLowerCase().includes(kw))) {
        document.getElementById('emergencyModal').style.display = 'flex';
    }

    document.getElementById("response").innerHTML = "<p>⏳ Generating Deep Medical Diagnostic Analysis with Gemini...</p>";

    fetch("/ask", { 
        method: "POST", 
        headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify({ query: query }) 
    })
    .then(res => res.json())
    .then(data => {
        if(data.error) throw new Error(data.error);
        handleAdvancedJSONResponse(data);
        refreshAppData();
    })
    .catch(err => document.getElementById("response").innerHTML = "<p style='color:red;'>Connection to AI diagnosis engine failed.</p>");
}

function handleAdvancedJSONResponse(data) {
    lastAiData = data;
    document.getElementById("response").innerHTML = ""; // Clear loader
    document.getElementById("advancedInsights").style.display = "block";

    // Overall Stats
    document.getElementById("riskScoreText").innerText = data.health_score;
    document.getElementById("riskLevel").innerText = data.severity + " Severity";
    document.getElementById("aiSeverity").innerText = "Risk Level: " + data.risk_level;
    document.getElementById("aiConfidence").innerText = (data.confidence_score || 92) + "%";

    let color = data.severity.toLowerCase() === 'high' ? 'var(--danger)' : data.severity.toLowerCase() === 'moderate' ? 'var(--warning)' : 'var(--success)';
    document.getElementById("riskScoreCircle").style.background = `conic-gradient(${color} ${data.health_score}%, rgba(0,0,0,0.1) 0)`;

    // Top Diseases
    let dHTML = "";
    data.diseases.forEach(d => {
        dHTML += `<div class="prob-item"><span>${d.name}</span> <strong>${d.confidence}%</strong></div>`;
    });
    document.getElementById("topDiseasesList").innerHTML = dHTML;
