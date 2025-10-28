// Test script for proper auth endpoints
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
  console.log("Testing Proper Auth Endpoints...\n");

  // Test 1: Try to login with non-existent user
  try {
    console.log("1. Testing login with non-existent user");
    const loginResponse = await makeRequest("/api/auth/login", "POST", {
      email: "nonexistent@example.com",
      password: "password123",
    });
    console.log("Status:", loginResponse.status);
    console.log("Response:", JSON.stringify(loginResponse.data, null, 2));
    console.log("");
  } catch (error) {
    console.error("Login test failed:", error.message);
  }

  // Test 2: Register a new user
  try {
    console.log("2. Testing user registration");
    const registerResponse = await makeRequest("/api/auth/register", "POST", {
      email: "testuser@example.com",
      password: "password123",
    });
    console.log("Status:", registerResponse.status);
    console.log("Response:", JSON.stringify(registerResponse.data, null, 2));
    console.log("");
  } catch (error) {
    console.error("Register test failed:", error.message);
  }

  // Test 3: Try to register the same user again
  try {
    console.log("3. Testing duplicate user registration");
    const registerResponse2 = await makeRequest("/api/auth/register", "POST", {
      email: "testuser@example.com",
      password: "password123",
    });
    console.log("Status:", registerResponse2.status);
    console.log("Response:", JSON.stringify(registerResponse2.data, null, 2));
    console.log("");
  } catch (error) {
    console.error("Duplicate register test failed:", error.message);
  }

  // Test 4: Login with the registered user
  try {
    console.log("4. Testing login with registered user");
    const loginResponse = await makeRequest("/api/auth/login", "POST", {
      email: "testuser@example.com",
      password: "password123",
    });
    console.log("Status:", loginResponse.status);
    console.log("Response:", JSON.stringify(loginResponse.data, null, 2));
    console.log("");
  } catch (error) {
    console.error("Login test failed:", error.message);
  }

  // Test 5: Login with wrong password
  try {
    console.log("5. Testing login with wrong password");
    const loginResponse = await makeRequest("/api/auth/login", "POST", {
      email: "testuser@example.com",
      password: "wrongpassword",
    });
    console.log("Status:", loginResponse.status);
    console.log("Response:", JSON.stringify(loginResponse.data, null, 2));
    console.log("");
  } catch (error) {
    console.error("Wrong password test failed:", error.message);
  }

  // Test 6: Logout
  try {
    console.log("6. Testing logout");
    const logoutResponse = await makeRequest("/api/auth/logout", "POST");
    console.log("Status:", logoutResponse.status);
    console.log("Response:", JSON.stringify(logoutResponse.data, null, 2));
    console.log("");
  } catch (error) {
    console.error("Logout test failed:", error.message);
  }
}

testAuth();
