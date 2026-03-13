const axios = require("axios");

const storeHash = "jlmaubflvk";
const clientId = "dtb2sgkh1zpcxzdgu0ly7a16so2mp3u";
const accessToken = "gft8y3fgyxnat4i4zj852f7lpdtnyvj";

// ngrok / public URL
const destinationUrl = "https://0ae0-2405-201-4018-90a7-c49b-1c4b-a7d9-984d.ngrok-free.app/order-events";

const api = axios.create({
  baseURL: `https://api.bigcommerce.com/stores/${storeHash}/v3`,
  headers: {
    "X-Auth-Client": clientId,
    "X-Auth-Token": accessToken,
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

async function createRefundWebhook() {
  try {

    const response = await api.post("/hooks", {
      scope: "store/order/refund/created",
      destination: destinationUrl,
      is_active: true,
    });

    console.log("✅ Refund webhook created successfully");
    console.log(response.data);

  } catch (error) {

    console.error(
      "❌ Webhook creation failed:",
      error.response?.data || error.message
    );

  }
}

createRefundWebhook();