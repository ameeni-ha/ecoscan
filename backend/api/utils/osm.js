const axios = require("axios");
const { OVERPASS_ENDPOINTS } = require("./constants");

const runOverpassQuery = async (query) => {
  const overpassBody = new URLSearchParams({ data: query }).toString();
  let lastError = null;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const response = await axios.post(endpoint, overpassBody, {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "ecoscan/1.0 (recycling centers lookup)",
        },
        timeout: 30000,
      });
      return response;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("Overpass request failed");
};

module.exports = {
  runOverpassQuery,
};
