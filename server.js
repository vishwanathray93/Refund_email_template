const express = require("express");
const axios = require("axios");
const nodemailer = require("nodemailer");
const bodyParser = require("body-parser");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(bodyParser.json());

const storeHash = "jlmaubflvk";
const clientId = "dtb2sgkh1zpcxzdgu0ly7a16so2mp3u";
const accessToken = "gft8y3fgyxnat4i4zj852f7lpdtnyvj";

const v3Headers = {
  "X-Auth-Client": clientId,
  "X-Auth-Token": accessToken,
  Accept: "application/json",
  "Content-Type": "application/json",
};

const v2Headers = {
  "X-Auth-Token": accessToken,
  Accept: "application/json",
};

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: "rdrori@clearstonecapitalpartners.com",
    pass: "kmfa gnui sjbo trbu",
  },
  tls: {
    rejectUnauthorized: false,
  },
});
 
// Verify at startup
transporter.verify((err, success) => {
  if (err) {
    console.error("🚨 SMTP VERIFY FAILED");
    console.error("Message:", err.message || err);
  } else {
    console.log("✅ SMTP VERIFIED — Ready to send emails (auth user:", transporter.options.auth?.user, ")");
  }
});

function getFrontendLinks(orderId) {
  return {
    reviewOrderLink: `https://venuemarketplace.com/account.php?action=order_status&order_id=${orderId}`,
    ordersLink: `https://venuemarketplace.com/account.php?action=order_status`,
    accountLink: `https://venuemarketplace.com/account.php`,
    buyAgainLink: `https://venuemarketplace.com/search.php?mode=recurring`,
  };
}

async function sendRefundEmail(order, refundReason, itemsHTML, billingAddressHTML, shippingAddressHTML) {

  const templatePath = path.join(__dirname,"emailTemplates","orderRefunded.html");

  let template = fs.readFileSync(templatePath,"utf8");

  const rawDate = new Date(order.date_created);

  const orderDate = rawDate.toLocaleDateString("en-US",{
    year:"numeric",
    month:"long",
    day:"numeric"
  });

  const orderTime = rawDate.toLocaleTimeString("en-US",{
    hour:"2-digit",
    minute:"2-digit"
  });

  const {
    reviewOrderLink,
    ordersLink,
    accountLink,
    buyAgainLink
  } = getFrontendLinks(order.id);

  template = template
  .replace(/{{orderId}}/g, order.id)
  .replace(/{{customerName}}/g, order.billing_address.first_name)
  .replace(/{{orderTotal}}/g, order.total_inc_tax)
  .replace(/{{items}}/g, itemsHTML)
  .replace(/{{billingAddress}}/g, billingAddressHTML)
  .replace(/{{shippingAddress}}/g, shippingAddressHTML)
  .replace(/{{paymentMethod}}/g, order.payment_method)
  .replace(/{{shippingMethod}}/g, order.shipping_method)
  .replace(/{{reviewOrderLink}}/g, reviewOrderLink)
  .replace(/{{ordersLink}}/g, ordersLink)
  .replace(/{{accountLink}}/g, accountLink)
  .replace(/{{buyAgainLink}}/g, buyAgainLink)
  .replace(/{{orderDate}}/g, orderDate)
  .replace(/{{orderTime}}/g, orderTime)
  .replace(/{{refundReason}}/g, refundReason);

  const toEmail = order.billing_address.email;

 const mailOptions = {
  from: `"Venue Marketplace" <rdrori@clearstonecapitalpartners.com>`,
  to: toEmail,
  subject: `Refund Processed for Order #${order.id}`,
  html: template,

  envelope: {
    from: "rdrori@clearstonecapitalpartners.com",
    to: toEmail,
  },
};

console.log(
  "→ Sending mail. SMTP auth user:",
  transporter.options.auth?.user || "unknown"
);

console.log("→ Mail headers from:", mailOptions.from);
console.log("→ Envelope.from (SMTP):", mailOptions.envelope.from);
console.log("→ Recipient:", mailOptions.to);

const info = await transporter.sendMail(mailOptions);

console.log(
  `Refund email sent for order ${order.id} — id: ${
    info.messageId || JSON.stringify(info)
  }`
);

  console.log("Refund email sent");
}

app.post("/order-events", async (req,res)=>{

try{

const scope = req.body.scope;
const orderId = req.body.data?.id;

if(scope !== "store/order/refund/created"){
  return res.send("ignored");
}

console.log("Refund webhook received for order",orderId);

const orderResp = await axios.get(
`https://api.bigcommerce.com/stores/${storeHash}/v2/orders/${orderId}`,
{headers:v2Headers}
);

const order = orderResp.data;

const refundResp = await axios.get(
`https://api.bigcommerce.com/stores/${storeHash}/v3/orders/${orderId}/payment_actions/refunds`,
{headers:v3Headers}
);

const refunds = refundResp.data.data || [];
const refund = refunds[0] || {};

const refundReason = refund.reason || "No reason provided";

const itemsResp = await axios.get(
`https://api.bigcommerce.com/stores/${storeHash}/v2/orders/${orderId}/products`,
{headers:v2Headers}
);

const items = itemsResp.data;

let itemsHTML = "";

for (const item of items) {

  let imageUrl = "https://via.placeholder.com/100";
  let productUrl = `https://venuemarketplace.com/products/${item.product_id}`;

  try {

    const productResp = await axios.get(
      `https://api.bigcommerce.com/stores/${storeHash}/v3/catalog/products/${item.product_id}?include=primary_image`,
      { headers: v3Headers }
    );

    const product = productResp.data.data;

    if (product.primary_image?.url_standard) {
      imageUrl = product.primary_image.url_standard;
    }

    if (product.custom_url?.url) {
      productUrl = `https://venuemarketplace.com${product.custom_url.url}`;
    }

  } catch (e) {
    console.log("Product fetch failed", e.message);
  }

  itemsHTML += `
  <table width="100%" style="margin-bottom:15px;border-bottom:1px solid #eee;padding-bottom:10px;">
    <tr>
      <td width="90">
        <a href="${productUrl}">
          <img src="${imageUrl}" width="80" style="border-radius:6px;">
        </a>
      </td>

      <td style="padding-left:10px;">
        <a href="${productUrl}" style="text-decoration:none;color:#000;font-weight:600;">
          ${item.name}
        </a>
        <div style="font-size:13px;color:#777;">
          Quantity: ${item.quantity}
        </div>
      </td>

      <td align="right" style="font-weight:700;">
        $${(item.price_inc_tax * item.quantity).toFixed(2)}
      </td>

    </tr>
  </table>
  `;
}
const b = order.billing_address;

const billingAddressHTML =
`${b.first_name} ${b.last_name}, ${b.street_1}, ${b.city}, ${b.state} ${b.zip}, ${b.country}, Phone: ${b.phone}`;

let shippingAddressHTML = "N/A";

try{

const shipResp = await axios.get(
`https://api.bigcommerce.com/stores/${storeHash}/v2/orders/${orderId}/shipping_addresses`,
{headers:v2Headers}
);

if(shipResp.data.length){

const s = shipResp.data[0];

shippingAddressHTML =
`${s.first_name} ${s.last_name}, ${s.street_1}, ${s.city}, ${s.state} ${s.zip}, ${s.country}, Phone: ${s.phone}`;

}

}catch(e){}

await sendRefundEmail(
order,
refundReason,
itemsHTML,
billingAddressHTML,
shippingAddressHTML
);

res.send("refund email sent");

}catch(err){

console.log(err.response?.data || err.message);

res.status(500).send("error");

}

});

const PORT = 5000;

app.listen(PORT,()=>{
console.log("Refund webhook server running on port",PORT);
});