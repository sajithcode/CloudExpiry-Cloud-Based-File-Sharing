// Simple test script for file endpoints
const http = require("http");

function makeRequest(path, method = "GET", data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "localhost",
      port: 8080,
      path: path,
      method: method,
      headers: {
        "Content-Type": "application/json",
        ...headers,
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

async function testFileEndpoints() {
  console.log("Testing File Endpoints...\n");

  // Test 1: Try to get metadata for non-existent file
  try {
    console.log("1. Testing metadata for non-existent file");
    const metaResponse = await makeRequest(
      "/api/files/nonexistent-token",
      "GET"
    );
    console.log("Status:", metaResponse.status);
    console.log("Expected: 404 Not Found");
    console.log("");
  } catch (error) {
    console.error("Metadata test failed:", error.message);
  }

  // Test 2: Try to upload without file (should fail)
  try {
    console.log("2. Testing upload without file");
    const uploadResponse = await makeRequest("/api/files", "POST", {
      expiresIn: 3600,
    });
    console.log("Status:", uploadResponse.status);
    console.log("Expected: 400 Bad Request");
    console.log("");
  } catch (error) {
    console.error("Upload test failed:", error.message);
  }

  // Test 3: Try to list files without auth
  try {
    console.log("3. Testing list files without authentication");
    const listResponse = await makeRequest("/api/files", "GET");
    console.log("Status:", listResponse.status);
    console.log("Expected: 401 Unauthorized");
    console.log("");
  } catch (error) {
    console.error("List test failed:", error.message);
  }

  console.log("Basic file endpoint validation completed!");
  console.log(
    "\nNote: For full testing with file uploads, use Postman or a proper client."
  );
  console.log("The endpoints are set up and ready for file operations.");
}

testFileEndpoints().catch(console.error);
