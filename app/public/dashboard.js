function getStoredToken() {
  return localStorage.getItem("startup_ai_token") || "";
}

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("startup_ai_user") || "null");
  } catch (_) {
    return null;
  }
}

function setMessage(message, isError = false) {
  const el = document.getElementById("message");
  if (!el) return;
  el.textContent = message;
  el.className = isError
    ? "mb-4 rounded-xl bg-rose-500/15 px-4 py-3 text-sm text-rose-200"
    : "mb-4 rounded-xl bg-emerald-500/15 px-4 py-3 text-sm text-emerald-200";
  el.classList.remove("hidden");
}

function logout() {
  localStorage.removeItem("startup_ai_token");
  localStorage.removeItem("startup_ai_user");
  window.location.href = "login.html";
}


async function loadDashboard() {
  const token = getStoredToken();
  if (!token) {
    window.location.href = "login.html";
    return;
  }

  try {
    const response = await fetch("/api/dashboard", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(data?.error || "Unauthorized access.");
    }

    const user = getStoredUser() || data.user || {};
    document.getElementById("welcome-title").textContent = `Welcome, ${user.username || "User"}`;
    document.getElementById("welcome-copy").textContent = data.message || "Your protected dashboard is ready.";
    document.getElementById("ideas-analyzed").textContent = data.stats?.ideasAnalyzed ?? 0;
    document.getElementById("saved-ideas").textContent = data.stats?.savedIdeas ?? 0;
    document.getElementById("account-status").textContent = data.stats?.accountStatus || "Active";

    const nextSteps = document.getElementById("next-steps");
    nextSteps.innerHTML = "";
    (data.nextSteps || []).forEach((item) => {
      const li = document.createElement("li");
      li.className = "rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3";
      li.textContent = item;
      nextSteps.appendChild(li);
    });

    // Show saved ideas
    const ideasList = document.getElementById("saved-ideas-list");
    if (ideasList) {
      ideasList.innerHTML = "";
      if (data.ideas && data.ideas.length > 0) {
        data.ideas.forEach((idea) => {
          const card = document.createElement("div");
          card.className = "rounded-2xl border border-white/10 bg-slate-900/60 p-4";
          card.innerHTML = `
            <div class="flex items-center justify-between">
              <div>
                <h4 class="text-lg font-semibold">${idea.title}</h4>
                <p class="text-xs text-slate-400">${new Date(idea.created_at).toLocaleString()}</p>
              </div>
              <button class="toggle-details text-indigo-300 underline text-xs">Show Details</button>
            </div>
            <div class="idea-details mt-3 hidden">
              <div class="mb-2"><span class="font-semibold">Description:</span> ${idea.description}</div>
              <div class="mb-2"><span class="font-semibold">Target Audience:</span> ${idea.target_audience}</div>
              <div class="mb-2"><span class="font-semibold">Analysis:</span>
                <pre class="bg-slate-800 text-slate-100 p-2 rounded-xl overflow-x-auto text-xs">${typeof idea.analysis === "object" ? JSON.stringify(idea.analysis, null, 2) : idea.analysis}</pre>
              </div>
            </div>
          `;
          ideasList.appendChild(card);
        });
        // Add toggle logic
        ideasList.querySelectorAll('.toggle-details').forEach((btn, idx) => {
          btn.addEventListener('click', function() {
            const details = ideasList.querySelectorAll('.idea-details')[idx];
            if (details) details.classList.toggle('hidden');
            btn.textContent = details.classList.contains('hidden') ? 'Show Details' : 'Hide Details';
          });
        });
      } else {
        ideasList.innerHTML = '<div class="text-slate-400">No ideas saved yet.</div>';
      }
    }
  } catch (error) {
    setMessage(error.message, true);
    setTimeout(() => {
      logout();
    }, 1200);
  }
}

document.getElementById("logout-btn")?.addEventListener("click", logout);
loadDashboard();


// Remaining logic for dashboard
