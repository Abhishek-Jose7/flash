# 🚀 Zero-Lag Cloud Deployment Guide

This guide details how to host your Spider-Verse flashmob platform on dedicated, **non-sleeping cloud infrastructure** at **$0 cost** using either **DigitalOcean (\$200 Free Credits)** or **AWS (12-Month Free Tier)**.

Because your QR code is physically printed, the server must **never go to sleep** and must maintain an immutable, permanent URL (`https://live.yourdomain.com`).

---

## 🏆 PATH 1: DigitalOcean App Platform (Easiest — 3-Minute GUI Setup)

If you have or sign up for DigitalOcean (which gives **$200 in free credits** on new signups or via GitHub Student Pack), this is the simplest method because it requires **no terminal commands on a server**.

### Step-by-Step:
1. **Push your code to GitHub**:
   ```bash
   git add .
   git commit -m "feat: cloud deployment ready"
   git push origin main
   ```
2. **Log into [DigitalOcean](https://cloud.digitalocean.com/)** and click **"Create" → "Apps"**.
3. **Select GitHub** and choose your `spiderverse-flashmob` repository (branch: `main`).
4. DigitalOcean automatically detects the `Dockerfile`.
5. **Configure Resources**:
   * **Resource Size:** Choose **Basic** (\$5/month — covered 100% by your \$200 free credits!).
   * **HTTP Port:** `3000`
   * **Environment Variables**:
     * `ADMIN_KEY`: `spiderverse`
6. Click **"Next" → "Create Resources"**.
7. In ~2 minutes, your app is live at a URL like `https://spiderverse-flashmob-abcde.ondigitalocean.app`.

### Attach Your Custom Domain (`live.yourdomain.com`):
1. In your App settings in DigitalOcean, click **"Settings" → "Domains" → "Add Domain"**.
2. Type `live.yourdomain.com`.
3. DigitalOcean gives you a CNAME target. Add this CNAME record in your DNS provider (Vercel, Cloudflare, GoDaddy, etc.).
4. DigitalOcean provisions a free SSL certificate automatically. Done!

---

## ⚡ PATH 2: AWS EC2 (100% Free 12-Month Tier)

AWS gives you **750 hours/month of EC2 (t2.micro / t3.micro)** for **12 months free** (which runs a server 24/7 at \$0 cost).

### Step 1: Launch an EC2 Instance (2 Minutes)
1. Log into the **[AWS Management Console](https://console.aws.amazon.com/)**.
2. Navigate to **EC2** and click **"Launch Instance"**.
3. **Settings:**
   * **Name:** `spiderverse-flashmob`
   * **OS Image:** Select **Ubuntu 24.04 LTS (Free tier eligible)**.
   * **Instance Type:** Select `t2.micro` or `t3.micro` (**Free tier eligible**).
   * **Key Pair:** Select an existing key pair or create a new one (download the `.pem` file).
   * **Network Settings (Firewall / Security Group):**
     * Check: ✅ **Allow SSH traffic from anywhere**
     * Check: ✅ **Allow HTTP traffic from the internet (Port 80)**
     * Check: ✅ **Allow HTTPS traffic from the internet (Port 443)**
4. Click **"Launch Instance"**.

---

### Step 2: Connect to Your Instance
In the AWS Console, select your running instance and click **"Connect" → "EC2 Instance Connect"** (opens a terminal right inside your web browser — no SSH software required!).

---

### Step 3: Launch with Docker & Caddy (1 Command!)
Paste this single command into the AWS terminal:

```bash
# 1. Install Docker & Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh && sudo sh get-docker.sh
sudo usermod -aG docker ubuntu

# 2. Clone your repository (replace with your repo URL)
git clone https://github.com/<YOUR-USERNAME>/spiderverse-flashmob.git app
cd app

# 3. Create your .env file with your custom domain
echo "DOMAIN_NAME=live.yourdomain.com" > .env
echo "ADMIN_KEY=spiderverse" >> .env

# 4. Start everything!
sudo docker compose up -d --build
```

---

### Step 4: Point Your DNS to AWS
1. In the AWS EC2 dashboard, copy your instance's **Public IPv4 address** (e.g. `54.210.45.120`).
2. Go to your DNS provider (Vercel, Cloudflare, GoDaddy, etc.):
   * Add an **A Record**:
     * **Name:** `live`
     * **Value:** `54.210.45.120` (your AWS IP)
3. **That's it!** Caddy automatically detects the domain, acquires a free Let's Encrypt SSL certificate, and serves your app over secure HTTPS and WSS.

---

## 🎯 Verification Checklist

Before your printed flyers are distributed:
- [ ] Open `https://live.yourdomain.com` on your mobile phone on 4G/5G to verify instant load.
- [ ] Open `https://live.yourdomain.com/stage` on your projector laptop to ensure the live QR code points to `https://live.yourdomain.com`.
- [ ] Open `https://live.yourdomain.com/admin` to confirm the host controls work.
- [ ] Test 1 question to verify real-time spider node illumination.
