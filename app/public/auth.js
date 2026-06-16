function showMessage(message, isError = false) {
  const el = document.getElementById("message");
  if (!el) return;
  el.textContent = message;
  el.className = isError
    ? "mb-4 rounded-xl bg-rose-500/15 px-4 py-3 text-sm text-rose-200"
    : "mb-4 rounded-xl bg-emerald-500/15 px-4 py-3 text-sm text-emerald-200";
  el.classList.remove("hidden");
}

function saveAuthData(data) {
  localStorage.setItem("startup_ai_token", data.token);
  localStorage.setItem("startup_ai_user", JSON.stringify(data.user));
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error || "Request failed.");
  }

  return data;
}

function initLoginPage() {
  const form = document.getElementById("login-form");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const loginBtn = document.getElementById("login-btn");
    loginBtn.disabled = true;

    try {
      const data = await postJson("/api/auth/login", {
        email: document.getElementById("email").value.trim(),
        password: document.getElementById("password").value,
      });

      saveAuthData(data);
      showMessage("Login successful. Redirecting...");
      window.location.href = "dashboard.html";
    } catch (error) {
      showMessage(error.message, true);
    } finally {
      loginBtn.disabled = false;
    }
  });
}

function initSignupPage() {
  const form = document.getElementById("signup-form");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const signupBtn = document.getElementById("signup-btn");
    signupBtn.disabled = true;

    try {
      const data = await postJson("/api/auth/signup", {
        username: document.getElementById("username").value.trim(),
        email: document.getElementById("email").value.trim(),
        password: document.getElementById("password").value,
      });

      saveAuthData(data);
      showMessage("Account created successfully. Redirecting...");
      window.location.href = "dashboard.html";
    } catch (error) {
      showMessage(error.message, true);
    } finally {
      signupBtn.disabled = false;
    }
  });
}

initLoginPage();
initSignupPage();