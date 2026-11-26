
// ======================================
// TRIPOD VISION ADMIN DASHBOARD
// ======================================

const API = "http://localhost:5000";

let adminToken = sessionStorage.getItem("tv_admin_token");

const loginPanel = document.getElementById("loginPanel");
const dashboard = document.getElementById("dashboard");
const loginMessage = document.getElementById("loginMessage");
const messagesContainer = document.getElementById("messages");

let allContacts = [];
let allRevenue = [];
let visitorAnalytics = null;

// ======================================
// ADMIN LOGIN
// ======================================

async function login() {
  const password = document.getElementById("password").value;

  try {
    const response = await fetch(`${API}/api/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Login failed.");
    }

    adminToken = data.token;
    sessionStorage.setItem("tv_admin_token", adminToken);

    loginMessage.textContent = "";
    showDashboard();

  } catch (error) {
    loginMessage.textContent = error.message;
  }
}

// ======================================
// SHOW DASHBOARD
// ======================================

function showDashboard() {
  loginPanel.style.display = "none";
  dashboard.style.display = "block";

  loadMessages();
  loadPortfolio();
  loadMonthlyAnalytics();
  loadRevenue();
  loadVisitorAnalytics();
}

// ======================================
// MESSAGE ANALYTICS COUNTERS
// ======================================

function updateAnalytics() {
  const total = allContacts.length;
  const unread = allContacts.filter(contact => !contact.read).length;
  const read = allContacts.filter(contact => contact.read).length;

  document.getElementById("totalMessages").textContent = total;
  document.getElementById("unreadMessages").textContent = unread;
  document.getElementById("readMessages").textContent = read;
}

function updateAnalyticsStatus(message) {
  const status = document.getElementById("analyticsStatus");

  if (status) {
    status.textContent = message;
  }
}

// ======================================
// MONTHLY MESSAGES ANALYTICS
// ======================================

async function loadMonthlyAnalytics() {
  const chart = document.getElementById("monthlyChart");

  if (!chart) return;

  chart.textContent = "Loading monthly analytics...";

  try {
    const response = await fetch(
      `${API}/api/admin/analytics/monthly`,
      {
        headers: {
          Authorization: `Bearer ${adminToken}`
        }
      }
    );

    const data = await response.json();

    if (response.status === 401) {
      logout();
      throw new Error("Session expired. Please login again.");
    }

    if (!response.ok) {
      throw new Error(data.message || "Could not load monthly analytics.");
    }

    const months = data.monthlyData || [];

    chart.innerHTML = "";

    if (!months.length) {
      chart.textContent = "No monthly data available.";
      return;
    }

    const maxMessages = Math.max(
      1,
      ...months.map(item => Number(item.count) || 0)
    );

    months.forEach(item => {
      const count = Number(item.count) || 0;

      const row = document.createElement("div");
      row.className = "chart-row";

      const label = document.createElement("span");
      label.className = "chart-label";
      label.textContent = item.label || item.month || "Unknown";

      const track = document.createElement("div");
      track.className = "chart-bar-track";

      const fill = document.createElement("div");
      fill.className = "chart-bar-fill";
      fill.style.width = `${(count / maxMessages) * 100}%`;

      track.appendChild(fill);

      const number = document.createElement("span");
      number.className = "chart-count";
      number.textContent = count;

      row.append(label, track, number);
      chart.appendChild(row);
    });

  } catch (error) {
    chart.textContent = error.message;
  }
}

// ======================================
// WEBSITE VISITOR ANALYTICS
// ======================================

async function loadVisitorAnalytics() {
  const chart = document.getElementById("visitorChart");

  if (!chart) return;

  chart.textContent = "Loading visitor analytics...";

  try {
    const response = await fetch(
      `${API}/api/admin/analytics/visitors`,
      {
        headers: {
          Authorization: `Bearer ${adminToken}`
        }
      }
    );

    const data = await response.json();

    if (response.status === 401) {
      logout();
      throw new Error("Session expired. Please login again.");
    }

    if (!response.ok) {
      throw new Error(
        data.message || "Could not load visitor analytics."
      );
    }

    visitorAnalytics = data;

    document.getElementById("totalVisitors").textContent =
      Number(data.totalVisitors || 0).toLocaleString("en-PK");

    document.getElementById("todayVisitors").textContent =
      Number(data.todayVisitors || 0).toLocaleString("en-PK");

    document.getElementById("monthlyVisitors").textContent =
      Number(data.monthlyVisitors || 0).toLocaleString("en-PK");

    const months = data.monthlyData || [];

    chart.innerHTML = "";

    if (!months.length) {
      chart.textContent = "No visitor data available yet.";
      return;
    }

    const maxVisitors = Math.max(
      1,
      ...months.map(item => Number(item.count) || 0)
    );

    months.forEach(item => {
      const count = Number(item.count) || 0;

      const row = document.createElement("div");
      row.className = "chart-row";

      const label = document.createElement("span");
      label.className = "chart-label";
      label.textContent = item.label || item.month || "Unknown";

      const track = document.createElement("div");
      track.className = "chart-bar-track";

      const fill = document.createElement("div");
      fill.className = "chart-bar-fill";
      fill.style.width = `${(count / maxVisitors) * 100}%`;

      track.appendChild(fill);

      const number = document.createElement("span");
      number.className = "chart-count";
      number.textContent = count.toLocaleString("en-PK");

      row.append(label, track, number);
      chart.appendChild(row);
    });

  } catch (error) {
    chart.textContent = error.message;
  }
}

// ======================================
// LOAD CUSTOMER MESSAGES
// ======================================

async function loadMessages() {
  messagesContainer.textContent = "Loading messages...";

  try {
    const response = await fetch(`${API}/api/admin/contacts`, {
      headers: {
        Authorization: `Bearer ${adminToken}`
      }
    });

    const data = await response.json();

    if (response.status === 401) {
      logout();
      throw new Error("Session expired. Please login again.");
    }

    if (!response.ok) {
      throw new Error(data.message || "Could not load messages.");
    }

    allContacts = data.contacts || [];

    updateAnalytics();
    updateAnalyticsStatus("Analytics updated successfully.");

    renderMessages();
    renderRecentInquiries();

  } catch (error) {
    messagesContainer.textContent = error.message;
    updateAnalyticsStatus("Could not update message analytics.");
  }
}

// ======================================
// DISPLAY ALL MESSAGES
// ======================================

function renderMessages() {
  messagesContainer.innerHTML = "";

  if (!allContacts.length) {
    messagesContainer.textContent = "No customer inquiries yet.";
    return;
  }

  allContacts.forEach(contact => {
    const card = document.createElement("article");
    card.className = "message-card";

    const heading = document.createElement("h3");
    heading.textContent = contact.name;

    const email = document.createElement("p");
    email.textContent = "Email: " + contact.email;

    const phone = document.createElement("p");
    phone.textContent = "Phone: " + (contact.phone || "Not provided");

    const message = document.createElement("p");
    message.textContent = "Message: " + contact.message;

    const date = document.createElement("p");
    date.textContent = "Date: " +
      (contact.createdAt
        ? new Date(contact.createdAt).toLocaleString()
        : "Unknown");

    const status = document.createElement("span");
    status.className = "status";
    status.textContent = contact.read ? "READ" : "UNREAD";

    const readButton = document.createElement("button");
    readButton.textContent = contact.read ? "MARK UNREAD" : "MARK READ";

    readButton.addEventListener("click", () => {
      updateReadStatus(contact._id, !contact.read);
    });

    const deleteButton = document.createElement("button");
    deleteButton.textContent = "DELETE";
    deleteButton.className = "delete-btn";

    deleteButton.addEventListener("click", () => {
      deleteMessage(contact._id);
    });

    card.append(
      heading,
      email,
      phone,
      message,
      date,
      status,
      document.createElement("br"),
      readButton,
      deleteButton
    );

    messagesContainer.appendChild(card);
  });
}

// ======================================
// RECENT 5 CUSTOMER INQUIRIES
// ======================================

function renderRecentInquiries() {
  const container = document.getElementById("recentInquiries");

  if (!container) return;

  container.innerHTML = "";

  if (!allContacts.length) {
    container.textContent = "No recent inquiries yet.";
    return;
  }

  const recent = [...allContacts]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5);

  recent.forEach(contact => {
    const card = document.createElement("div");
    card.className = "message-card";

    const name = document.createElement("h3");
    name.textContent = contact.name;

    const email = document.createElement("p");
    email.textContent = "Email: " + contact.email;

    const message = document.createElement("p");
    message.textContent = "Message: " + contact.message;

    const date = document.createElement("p");
    date.textContent = "Date: " +
      (contact.createdAt
        ? new Date(contact.createdAt).toLocaleString()
        : "Unknown");

    const status = document.createElement("span");
    status.className = "status";
    status.textContent = contact.read ? "READ" : "UNREAD";

    card.append(name, email, message, date, status);
    container.appendChild(card);
  });
}

// ======================================
// MARK READ / UNREAD
// ======================================

async function updateReadStatus(id, read) {
  try {
    const response = await fetch(
      `${API}/api/admin/contacts/${id}/read`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({ read })
      }
    );

    if (!response.ok) {
      throw new Error("Could not update message status.");
    }

    loadMessages();

  } catch (error) {
    alert(error.message);
  }
}

// ======================================
// DELETE CUSTOMER MESSAGE
// ======================================

async function deleteMessage(id) {
  if (!confirm("Are you sure you want to delete this message?")) {
    return;
  }

  try {
    const response = await fetch(
      `${API}/api/admin/contacts/${id}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${adminToken}`
        }
      }
    );

    if (!response.ok) {
      throw new Error("Could not delete message.");
    }

    loadMessages();
    loadMonthlyAnalytics();

  } catch (error) {
    alert(error.message);
  }
}

// ======================================
// LOAD PORTFOLIO
// ======================================

async function loadPortfolio() {
  const portfolioList = document.getElementById("portfolioList");

  portfolioList.textContent = "Loading projects...";

  try {
    const response = await fetch(`${API}/api/portfolio`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error("Could not load portfolio.");
    }

    const projects = data.projects || [];

    document.getElementById("totalProjects").textContent =
      projects.length;

    portfolioList.innerHTML = "";

    if (!projects.length) {
      portfolioList.textContent = "No portfolio projects yet.";
      return;
    }

    projects.forEach(project => {
      const card = document.createElement("div");
      card.className = "project-card";

      const title = document.createElement("h3");
      title.textContent = project.title;

      const category = document.createElement("p");
      category.textContent = "Category: " + project.category;

      const description = document.createElement("p");
      description.textContent = project.description || "";

      const image = document.createElement("img");
      image.src = `${API}${project.image}`;
      image.alt = project.title;

      const deleteButton = document.createElement("button");
      deleteButton.textContent = "DELETE PROJECT";
      deleteButton.className = "delete-btn";

      deleteButton.addEventListener("click", () => {
        deletePortfolio(project._id);
      });

      card.append(title, category, description, image, deleteButton);
      portfolioList.appendChild(card);
    });

  } catch (error) {
    portfolioList.textContent = error.message;
  }
}

// ======================================
// DELETE PORTFOLIO PROJECT
// ======================================

async function deletePortfolio(id) {
  if (!confirm("Delete this portfolio project?")) {
    return;
  }

  try {
    const response = await fetch(`${API}/api/admin/portfolio/${id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${adminToken}`
      }
    });

    if (!response.ok) {
      throw new Error("Could not delete project.");
    }

    loadPortfolio();

  } catch (error) {
    alert(error.message);
  }
}

// ======================================
// UPLOAD PORTFOLIO PROJECT
// ======================================

const portfolioForm = document.getElementById("portfolioForm");

portfolioForm.addEventListener("submit", async function(event) {
  event.preventDefault();

  const title = document.getElementById("projectTitle").value.trim();
  const category = document.getElementById("projectCategory").value;
  const description = document.getElementById("projectDescription").value.trim();
  const image = document.getElementById("projectImage").files[0];

  const portfolioMessage = document.getElementById("portfolioMessage");

  if (!title || !category || !image) {
    portfolioMessage.textContent = "Please fill all required fields.";
    return;
  }

  if (image.size > 5 * 1024 * 1024) {
    portfolioMessage.textContent = "Image must be smaller than 5 MB.";
    return;
  }

  const formData = new FormData();

  formData.append("title", title);
  formData.append("category", category);
  formData.append("description", description);
  formData.append("image", image);

  try {
    portfolioMessage.textContent = "Uploading project...";

    const response = await fetch(`${API}/api/admin/portfolio`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`
      },
      body: formData
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Upload failed.");
    }

    portfolioMessage.textContent = "Project uploaded successfully!";
    portfolioForm.reset();
    loadPortfolio();

  } catch (error) {
    portfolioMessage.textContent = error.message;
  }
});

// ======================================
// REVENUE ANALYTICS
// ======================================

function formatPKR(amount) {
  return Number(amount || 0).toLocaleString("en-PK");
}

function updateRevenueAnalytics() {
  const total = allRevenue.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0
  );

  const now = new Date();

  const monthly = allRevenue
    .filter(item => {
      const date = new Date(item.paymentDate);

      return date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear();
    })
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  document.getElementById("totalRevenue").textContent =
    formatPKR(total);

  document.getElementById("monthlyRevenue").textContent =
    formatPKR(monthly);
}

// ======================================
// MONTHLY REVENUE CHART
// ======================================

async function loadMonthlyRevenueAnalytics() {
  const chart = document.getElementById("revenueChart");

  if (!chart) return;

  chart.textContent = "Loading revenue analytics...";

  try {
    const response = await fetch(
      `${API}/api/admin/analytics/revenue`,
      {
        headers: {
          Authorization: `Bearer ${adminToken}`
        }
      }
    );

    const data = await response.json();

    if (response.status === 401) {
      logout();
      throw new Error("Session expired. Please login again.");
    }

    if (!response.ok) {
      throw new Error(
        data.message || "Could not load monthly revenue analytics."
      );
    }

    const months = data.monthlyData || [];

    chart.innerHTML = "";

    if (!months.length) {
      chart.textContent = "No monthly revenue data available.";
      return;
    }

    const maxRevenue = Math.max(
      1,
      ...months.map(item => Number(item.total) || 0)
    );

    months.forEach(item => {
      const total = Number(item.total) || 0;

      const row = document.createElement("div");
      row.className = "chart-row";

      const label = document.createElement("span");
      label.className = "chart-label";
      label.textContent = item.label || item.month || "Unknown";

      const track = document.createElement("div");
      track.className = "chart-bar-track";

      const fill = document.createElement("div");
      fill.className = "chart-bar-fill";
      fill.style.width = `${(total / maxRevenue) * 100}%`;

      track.appendChild(fill);

      const number = document.createElement("span");
      number.className = "chart-count";
      number.textContent = "PKR " + formatPKR(total);

      row.append(label, track, number);
      chart.appendChild(row);
    });

  } catch (error) {
    chart.textContent = error.message;
  }
}

// ======================================
// LOAD REVENUE RECORDS
// ======================================

async function loadRevenue() {
  const container = document.getElementById("revenueRecords");

  if (!container) return;

  container.textContent = "Loading payment records...";

  try {
    const response = await fetch(`${API}/api/admin/revenue`, {
      headers: {
        Authorization: `Bearer ${adminToken}`
      }
    });

    const data = await response.json();

    if (response.status === 401) {
      logout();
      throw new Error("Session expired. Please login again.");
    }

    if (!response.ok) {
      throw new Error(data.message || "Could not load revenue.");
    }

    allRevenue = data.records || [];

    updateRevenueAnalytics();
    renderRevenueRecords();

    loadMonthlyRevenueAnalytics();

  } catch (error) {
    container.textContent = error.message;
  }
}

// ======================================
// DISPLAY PAYMENT RECORDS
// ======================================

function renderRevenueRecords() {
  const container = document.getElementById("revenueRecords");

  container.innerHTML = "";

  if (!allRevenue.length) {
    container.textContent = "No payment records yet.";
    return;
  }

  allRevenue.forEach(record => {
    const card = document.createElement("div");
    card.className = "message-card";

    const title = document.createElement("h3");
    title.textContent = record.projectName;

    const amount = document.createElement("p");
    amount.textContent = "Amount: PKR " + formatPKR(record.amount);

    const date = document.createElement("p");
    date.textContent = "Payment Date: " +
      new Date(record.paymentDate).toLocaleDateString();

    const description = document.createElement("p");
    description.textContent =
      "Description: " + (record.description || "No description");

    const deleteButton = document.createElement("button");
    deleteButton.textContent = "DELETE PAYMENT";
    deleteButton.className = "delete-btn";

    deleteButton.addEventListener("click", () => {
      deleteRevenue(record._id);
    });

    card.append(title, amount, date, description, deleteButton);
    container.appendChild(card);
  });
}

// ======================================
// ADD NEW PAYMENT
// ======================================

const revenueForm = document.getElementById("revenueForm");

revenueForm.addEventListener("submit", async function(event) {
  event.preventDefault();

  const projectName = document.getElementById("revenueProject").value.trim();
  const amount = Number(document.getElementById("revenueAmount").value);
  const paymentDate = document.getElementById("revenueDate").value;
  const description = document.getElementById("revenueDescription").value.trim();

  const message = document.getElementById("revenueMessage");

  if (!projectName || !Number.isFinite(amount) || amount <= 0 || !paymentDate) {
    message.textContent = "Please enter valid payment details.";
    return;
  }

  try {
    message.textContent = "Saving payment...";

    const response = await fetch(`${API}/api/admin/revenue`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        projectName,
        amount,
        paymentDate,
        description
      })
    });

    const data = await response.json();

    if (response.status === 401) {
      logout();
      throw new Error("Session expired. Please login again.");
    }

    if (!response.ok) {
      throw new Error(data.message || "Could not save payment.");
    }

    message.textContent = "Payment saved successfully!";

    revenueForm.reset();

    loadRevenue();

  } catch (error) {
    message.textContent = error.message;
  }
});

// ======================================
// DELETE PAYMENT
// ======================================

async function deleteRevenue(id) {
  if (!confirm("Are you sure you want to delete this payment?")) {
    return;
  }

  try {
    const response = await fetch(`${API}/api/admin/revenue/${id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${adminToken}`
      }
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Could not delete payment.");
    }

    loadRevenue();

  } catch (error) {
    alert(error.message);
  }
}

// ======================================
// EXPORT REPORTS - CSV HELPER
// ======================================

function csvEscape(value) {
  let text = String(value ?? "");

  // Prevent spreadsheet formula execution
  if (/^[\s]*[=+\-@]/.test(text)) {
    text = "'" + text;
  }

  return '"' + text.replace(/"/g, '""') + '"';
}

function downloadCSV(filename, rows) {
  const csvContent = "\uFEFF" + rows
    .map(row => row.map(csvEscape).join(","))
    .join("\r\n");

  const blob = new Blob([csvContent], {
    type: "text/csv;charset=utf-8;"
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.style.display = "none";

  document.body.appendChild(link);
  link.click();

  // Browser ko download start karne ka waqt do
  setTimeout(() => {
    URL.revokeObjectURL(url);
    link.remove();
  }, 1000);
}

function showExportMessage(message) {
  const element = document.getElementById("exportMessage");

  if (element) {
    element.textContent = message;
  }
}

// ======================================
// EXPORT CUSTOMER CONTACTS
// ======================================

function exportContacts() {
  if (!allContacts.length) {
    showExportMessage("No customer contacts available to export.");
    return;
  }

  const rows = [
    ["Name", "Email", "Phone", "Message", "Status", "Date"]
  ];

  allContacts.forEach(contact => {
    rows.push([
      contact.name,
      contact.email,
      contact.phone || "",
      contact.message,
      contact.read ? "Read" : "Unread",
      contact.createdAt
        ? new Date(contact.createdAt).toLocaleString()
        : ""
    ]);
  });

  downloadCSV("Tripod_Vision_Contacts.csv", rows);

  showExportMessage("Contacts report downloaded successfully!");
}

// ======================================
// EXPORT REVENUE
// ======================================

function exportRevenue() {
  if (!allRevenue.length) {
    showExportMessage("No payment records available to export.");
    return;
  }

  const rows = [
    ["Project Name", "Amount (PKR)", "Payment Date", "Description"]
  ];

  allRevenue.forEach(record => {
    rows.push([
      record.projectName,
      Number(record.amount || 0),
      record.paymentDate
        ? new Date(record.paymentDate).toLocaleDateString()
        : "",
      record.description || ""
    ]);
  });

  downloadCSV("Tripod_Vision_Revenue.csv", rows);

  showExportMessage("Revenue report downloaded successfully!");
}

// ======================================
// EXPORT VISITOR ANALYTICS
// ======================================

function exportVisitors() {
  if (!visitorAnalytics) {
    showExportMessage("Visitor analytics are still loading. Please try again.");
    return;
  }

  const rows = [
    ["Report Type", "Month", "Metric", "Value"],
    ["Visitor Summary", "", "Total Unique Visitors",
      Number(visitorAnalytics.totalVisitors || 0)],
    ["Visitor Summary", "", "Today's Visitors",
      Number(visitorAnalytics.todayVisitors || 0)],
    ["Visitor Summary", "", "This Month's Visitors",
      Number(visitorAnalytics.monthlyVisitors || 0)]
  ];

  const months = visitorAnalytics.monthlyData || [];

  months.forEach(item => {
    rows.push([
      "Monthly Visitors",
      item.label || item.month || "",
      "Visitors",
      Number(item.count || 0)
    ]);
  });

  downloadCSV("Tripod_Vision_Visitors.csv", rows);

  showExportMessage("Visitor analytics report downloaded successfully!");
}

// ======================================
// EXPORT BUTTON EVENTS
// ======================================

document.getElementById("exportContactsBtn")
  .addEventListener("click", exportContacts);
document.getElementById("exportRevenueBtn")
  .addEventListener("click", exportRevenue);

document.getElementById("exportVisitorsBtn")
  .addEventListener("click", exportVisitors);

// ======================================
// LOGOUT
// ======================================

function logout() {
  sessionStorage.removeItem("tv_admin_token");

  adminToken = null;
  allContacts = [];
  allRevenue = [];
  visitorAnalytics = null;

  dashboard.style.display = "none";
  loginPanel.style.display = "block";

  document.getElementById("password").value = "";
}

// ======================================
// BUTTON EVENTS
// ======================================

document.getElementById("loginBtn").addEventListener("click", login);

document.getElementById("logoutBtn").addEventListener("click", logout);

document.getElementById("refreshBtn").addEventListener("click", () => {
  loadMessages();
  loadPortfolio();
  loadMonthlyAnalytics();
  loadRevenue();
  loadVisitorAnalytics();
});

// ======================================
// AUTO LOGIN
// ======================================

if (adminToken) {
  showDashboard();
}
