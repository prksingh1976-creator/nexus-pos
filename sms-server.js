import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

// =================================================================================
// 📱 DEFAULT CONFIGURATION
// These values act as fallbacks if the client doesn't send specific details.
// =================================================================================
const DEFAULT_PHONE_IP = "192.168.1.10"; 
const DEFAULT_PHONE_PORT = "8080"; 

app.post('/send-credit-alert', async (req, res) => {
    const { phone, customMessage, customerName, amount, totalBalance, type, deviceIp } = req.body;

    if (!phone) {
        console.log("❌ SMS Skipped: No phone number provided.");
        return res.status(400).json({ error: "No phone number" });
    }

    // Determine message content
    let message = '';
    if (customMessage) {
        message = customMessage;
    } else {
        message = type === 'payment' 
            ? `Dear ${customerName}, received payment of Rs ${Number(amount).toFixed(2)}. Remaining Balance: Rs ${Number(totalBalance).toFixed(2)}. - Nexus Shop`
            : `Dear ${customerName}, credit order of Rs ${Number(amount).toFixed(2)} added. Total Balance Due: Rs ${Number(totalBalance).toFixed(2)}. - Nexus Shop`;
    }

    // Determine Gateway URL
    const targetIp = deviceIp || DEFAULT_PHONE_IP;
    const gatewayUrl = `http://${targetIp}:${DEFAULT_PHONE_PORT}/v1/sms/send`;

    console.log(`\n📨 Sending SMS to ${phone}...`);
    console.log(`   Target Gateway: ${gatewayUrl}`);
    console.log(`   Message: "${message}"`);

    try {
        const response = await fetch(gatewayUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                phone: phone,
                message: message
            })
        });
        
        if (response.ok) {
            console.log("✅ SMS Sent Successfully via Phone!");
            res.json({ success: true });
        } else {
            console.error(`⚠️ Phone Gateway Error: ${response.status} ${response.statusText}`);
            res.status(500).json({ error: "Gateway Error" });
        }
    } catch (error) {
        console.error("❌ Failed to connect to Phone:", error.message);
        console.log(`   👉 TIP: Ensure Phone IP is correct in Settings (currently: ${targetIp})`);
        res.status(500).json({ error: "Phone unreachable" });
    }
});

const PORT = 3001;
app.listen(PORT, () => {
    console.log(`\n=========================================================`);
    console.log(`🚀 Nexus SMS Bridge running on http://localhost:${PORT}`);
    console.log(`📱 Default Target Phone: ${DEFAULT_PHONE_IP}:${DEFAULT_PHONE_PORT}`);
    console.log(`=========================================================\n`);
});