require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.static('.'));

// ensure uploads dir
const UPLOADS = path.join(__dirname, 'uploads');
if(!fs.existsSync(UPLOADS)) fs.mkdirSync(UPLOADS);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random()*1e6);
    const safe = file.originalname.replace(/[^a-zA-Z0-9.\-\_\u0600-\u06FF]/g, '_');
    cb(null, unique + '-' + safe);
  }
});
const upload = multer({ storage });

app.post('/submit', upload.single('cv'), async (req, res) => {
  try{
    const { fullName, email, phone, city, role, experience, skills, portfolio, notes } = req.body;
    const file = req.file;

    // build message
    const summary = `طلب توظيف - روافد\n\nالاسم: ${fullName}\nالبريد: ${email}\nالهاتف: ${phone}\nالموقع: ${city}\nالوظيفة: ${role}\nالخبرة: ${experience}\nالمهارات:\n${skills || '-'}\nروابط: ${portfolio || '-'}\nملاحظات: ${notes || '-'}\n`;

    // if SMTP configured, send mail
    if(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.TO_EMAIL){
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT||587),
        secure: (process.env.SMTP_SECURE==='true'),
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });

      const mailOptions = {
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: process.env.TO_EMAIL,
        subject: `طلب توظيف من ${fullName}`,
        text: summary,
      };
      if(file){
        mailOptions.attachments = [{ filename: file.originalname, path: file.path }];
      }

      await transporter.sendMail(mailOptions);
      // remove uploaded file after sending to avoid accumulation (optional)
      if(file && process.env.KEEP_UPLOADS !== 'true'){
        try{ fs.unlinkSync(file.path); }catch(e){console.warn('failed to remove upload', e)}
      }

      return res.json({ ok: true, message: 'تم استلام الطلب وسيتم مراجعته. شكراً.' });
    }

    // fallback: save summary and file locally
    const stamp = Date.now();
    const outPath = path.join(UPLOADS, `summary-${stamp}.txt`);
    fs.writeFileSync(outPath, summary, 'utf8');
    return res.json({ ok: true, message: 'تم حفظ الطلب محليًا على الخادم. لم يتم تهيئة إرسال البريد.' });

  }catch(err){
    console.error(err);
    res.status(500).send('server error');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=> console.log('Server running on port', PORT));
