
// ======================================
// TRIPOD VISION - MAIN JAVASCRIPT
// ======================================

const API = "http://localhost:5000";


// ======================================
// MOBILE MENU
// ======================================

const menuBtn = document.getElementById("menuBtn");
const navLinks = document.getElementById("navLinks");

if (menuBtn && navLinks) {
  menuBtn.addEventListener("click", () => {
    const isOpen = navLinks.classList.toggle("show");

    menuBtn.textContent = isOpen ? "✕" : "☰";
    menuBtn.setAttribute("aria-expanded", String(isOpen));
  });

  document.querySelectorAll(".nav-links a").forEach(link => {
    link.addEventListener("click", () => {
      navLinks.classList.remove("show");
      menuBtn.textContent = "☰";
      menuBtn.setAttribute("aria-expanded", "false");
    });
  });
}


// ======================================
// SCROLL ANIMATION
// ======================================

const revealElements = document.querySelectorAll(".reveal");

if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("active");
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.12
  });

  revealElements.forEach(element => observer.observe(element));
} else {
  revealElements.forEach(element => {
    element.classList.add("active");
  });
}


// ======================================
// COPYRIGHT YEAR
// ======================================

const yearElement = document.getElementById("year");

if (yearElement) {
  yearElement.textContent = new Date().getFullYear();
}


// ======================================
// CONTACT FORM
// ======================================

const contactForm = document.getElementById("contactForm");

if (contactForm) {
  contactForm.addEventListener("submit", async function(event) {
    event.preventDefault();

    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const phone = document.getElementById("phone").value.trim();
    const message = document.getElementById("message").value.trim();

    if (!name || !email || !message) {
      alert("Please fill in all required fields.");
      return;
    }

    try {
      const response = await fetch(`${API}/api/contact`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name,
          email,
          phone,
          message
        })
      });

      let result = {};

      try {
        result = await response.json();
      } catch {
        // No JSON response
      }

      if (!response.ok) {
        throw new Error(result.message || "Message could not be sent.");
      }

      alert("Thank you! Your message has been sent.");
      contactForm.reset();

    } catch (error) {
      console.error("Contact form error:", error);

      alert(
        "Message send nahi hua. Check karo ke backend server chal raha hai."
      );
    }
  });
}


// ======================================
// LOAD PORTFOLIO FROM MONGODB
// ======================================

async function loadPortfolio() {
  const grid = document.querySelector(".portfolio-grid");

  if (!grid) return;

  grid.innerHTML = "<p>Loading portfolio projects...</p>";

  try {
    const response = await fetch(`${API}/api/portfolio`);

    const data = await response.json();

    if (!response.ok) {
      throw new Error("Could not load portfolio projects.");
    }

    const projects = data.projects || [];

    grid.innerHTML = "";

    if (!projects.length) {
      grid.textContent = "Portfolio projects coming soon.";
      return;
    }

    projects.forEach(project => {
      const item = document.createElement("article");
      item.className = "portfolio-item";

      const image = document.createElement("img");

      const imagePath = project.image || "";

      image.src = imagePath.startsWith("http")
        ? imagePath
        : `${API}${imagePath}`;

      image.alt = project.title || "Portfolio project";
      image.loading = "lazy";

      const overlay = document.createElement("div");
      overlay.className = "portfolio-overlay";

      const title = document.createElement("h3");
      title.textContent = project.title || "Untitled Project";

      const category = document.createElement("span");
      category.textContent = project.category || "";

      const description = document.createElement("p");
      description.textContent = project.description || "";

      overlay.append(title, category, description);
      item.append(image, overlay);

      grid.appendChild(item);
    });

  } catch (error) {
    console.error("Portfolio error:", error);
    grid.textContent = "Portfolio could not load. Please try again later.";
  }
}


// ======================================
// LOAD ADMIN SERVICES
// ======================================

function loadAdminServices() {
  const grid = document.querySelector(".service-grid");

  if (!grid) return;

  let services = [];

  try {
    services = JSON.parse(
      localStorage.getItem("tv_services") || "[]"
    );
  } catch (error) {
    console.error("Services data error:", error);
  }

  if (!services.length) return;

  grid.innerHTML = "";

  services.forEach(service => {
    const card = document.createElement("article");
    card.className = "service-card";

    const icon = document.createElement("div");
    icon.className = "service-icon";
    icon.textContent = service.icon || "";

    const title = document.createElement("h3");
    title.textContent = service.title || "";

    const description = document.createElement("p");
    description.textContent = service.description || "";

    card.append(icon, title, description);
    grid.appendChild(card);
  });
}


// ======================================
// RUN WEBSITE FUNCTIONS
// ======================================

loadPortfolio();
loadAdminServices();

// ======================================
// TRIPOD VISION VISITOR TRACKING
// ======================================

(function trackWebsiteVisitor() {
  let visitorId = localStorage.getItem("tv_visitor_id");

  if (!visitorId) {
    visitorId = "tv_" + (
      window.crypto && crypto.randomUUID
        ? crypto.randomUUID()
        : Date.now() + "_" + Math.random().toString(36).slice(2)
    );

    localStorage.setItem("tv_visitor_id", visitorId);
  }

  fetch("http://localhost:5000/api/visitor", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ visitorId })
  }).catch(error => {
    console.error("Visitor tracking error:", error);
  });
})();
