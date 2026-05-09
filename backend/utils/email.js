const nodemailer = require('nodemailer');

const createTransporter = () => {
    return nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: process.env.SMTP_PORT || 587,
        secure: process.env.SMTP_PORT == 465, // true for 465, false for other ports
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });
};

const sendInterviewEmail = async (candidate, interview, position) => {
    try {
        if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
            console.warn('SMTP credentials not configured. Skipping email send.');
            return { success: false, message: 'Pengaturan SMTP belum dikonfigurasi.' };
        }

        const transporter = createTransporter();

        const dateStr = new Date(interview.interview_date).toLocaleDateString('id-ID', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        const timeStr = interview.interview_time ? interview.interview_time.substring(0, 5) : 'Menyesuaikan';

        const locationHtml = interview.type === 'online' 
            ? `<p><strong>Tipe Interview:</strong> Online / Virtual</p>
               <p><strong>Link Meeting:</strong> <a href="${interview.meeting_link || '#'}">${interview.meeting_link || 'Akan diinformasikan menyusul'}</a></p>`
            : `<p><strong>Tipe Interview:</strong> On-site / Tatap Muka</p>
               <p><strong>Lokasi:</strong> ${interview.location || 'Akan diinformasikan menyusul'}</p>`;

        const mailOptions = {
            from: `"Tim Rekrutmen" <${process.env.SMTP_USER}>`,
            to: candidate.email,
            subject: `Undangan Interview: Posisi ${position.title}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333; line-height: 1.6;">
                    <div style="background-color: #f8fafc; padding: 20px; border-bottom: 3px solid #0284c7; text-align: center;">
                        <h2 style="color: #0369a1; margin: 0;">Undangan Interview</h2>
                    </div>
                    
                    <div style="padding: 30px 20px;">
                        <p>Yth. <strong>${candidate.full_name}</strong>,</p>
                        
                        <p>Terima kasih atas ketertarikan Anda untuk melamar posisi <strong>${position.title}</strong> di perusahaan kami. 
                        Berdasarkan hasil seleksi awal, kami mengundang Anda untuk mengikuti tahapan interview.</p>
                        
                        <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; padding: 15px; border-radius: 5px; margin: 20px 0;">
                            <h3 style="margin-top: 0; color: #166534;">Detail Jadwal:</h3>
                            <p><strong>Tanggal:</strong> ${dateStr}</p>
                            <p><strong>Waktu:</strong> ${timeStr} WIB</p>
                            ${locationHtml}
                        </div>
                        
                        ${interview.notes ? `
                        <div style="margin-top: 20px;">
                            <p><strong>Catatan Tambahan:</strong></p>
                            <p style="background-color: #fffbeb; padding: 10px; border-left: 4px solid #f59e0b;">
                                ${interview.notes}
                            </p>
                        </div>
                        ` : ''}

                        <p style="margin-top: 30px;">Mohon balas email ini untuk mengonfirmasi kehadiran Anda.</p>
                        
                        <p>Terima kasih,<br><strong>Tim Rekrutmen / HRD</strong></p>
                    </div>
                    
                    <div style="background-color: #f1f5f9; padding: 15px; text-align: center; font-size: 12px; color: #64748b;">
                        <p>Email ini dikirim secara otomatis. Mohon tidak membalas langsung jika tidak ada konfirmasi.</p>
                    </div>
                </div>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Message sent: %s', info.messageId);
        return { success: true, messageId: info.messageId };

    } catch (error) {
        console.error('Error sending email:', error);
        return { success: false, error: error.message };
    }
};

module.exports = { sendInterviewEmail };
