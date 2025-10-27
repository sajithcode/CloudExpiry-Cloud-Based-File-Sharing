// Test script for auth endpoints
const http = require("http");

function makeRequest(path, method = "GET", data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "localhost",
      port: 8080,
      path: path,
      method: method,
      headers: {
        "Content-Type": "application/json",
      },
    };

    const req = http.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => {
        body += chunk;
      });
      res.on("end", () => {
        try {
          const response = JSON.parse(body);
          resolve({ status: res.statusCode, data: response });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on("error", (err) => {
      reject(err);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function testAuth() {
  console.log("Testing Auth Endpoints...\n");

  // Test register
  try {
    console.log("1. Testing POST /api/auth/register");
    const registerResponse = await makeRequest("/api/auth/register", "POST", {
      email: "newuser@example.com",
      password: "password123",
    });
    console.log("Status:", registerResponse.status);
    console.log("Response:", JSON.stringify(registerResponse.data, null, 2));
    console.log("");
  } catch (error) {
    console.error("Register test failed:", error.message);
  }

  // Test login
  try {
    console.log("2. Testing POST /api/auth/login");
    const loginResponse = await makeRequest("/api/auth/login", "POST", {
      email: "newuser@example.com",
      password: "password123",
    });
    console.log("Status:", loginResponse.status);
    console.log("Response:", JSON.stringify(loginResponse.data, null, 2));
    console.log("");
  } catch (error) {
    console.error("Login test failed:", error.message);
  }

  // Test logout
  try {
    console.log("3. Testing POST /api/auth/logout");
    const logoutResponse = await makeRequest("/api/auth/logout", "POST");
    console.log("Status:", logoutResponse.status);
    console.log("Response:", JSON.stringify(logoutResponse.data, null, 2));
    console.log("");
  } catch (error) {
    console.error("Logout test failed:", error.message);
  }
}

testAuth();
