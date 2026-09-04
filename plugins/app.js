const { generateWAMessageFromContent } = require('baileys');
const crypto = require('crypto');

module.exports = {
    name: "alya_app",
    category: "ai",
    description: "Alya AI Web App Interface",
    commands: ["app"],

    handler: async ({ socket, msg, sender, reply }) => {
        try {
            const botNumber = socket.user.id.split(':')[0]; // Bot ගේ නම්බර් එක ගන්නවා
            await socket.sendMessage(sender, { react: { text: '📱', key: msg.key } });

            // 🔥 API වෙනුවට wa.me Link එකක් පාවිච්චි කරලා Type කරන දේ WhatsApp එකට යවනවා
            let appHtml = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no"><style>body{margin:0;font-family:sans-serif;background:#050510;color:#fff;overflow:hidden}.w{display:flex;flex-direction:column;height:600px;width:100%}.h{padding:15px;background:#111;text-align:center;font-weight:800;font-size:18px;border-bottom:1px solid #333;color:#ff4081;box-shadow:0 2px 10px #000;display:flex;align-items:center;justify-content:center;gap:10px}.cb{flex:1;overflow-y:auto;padding:15px;display:flex;flex-direction:column;gap:12px;background:radial-gradient(circle at 50% 50%,#1a0b2e 0,#050510 100%)}.m{padding:10px 15px;border-radius:15px;max-width:85%;word-wrap:break-word;font-size:14px;line-height:1.4;box-shadow:0 3px 10px rgba(0,0,0,.3)}.u{align-self:flex-end;background:linear-gradient(135deg,#ff4081,#c51162);color:#fff;border-bottom-right-radius:4px}.b{align-self:flex-start;background:#222;color:#eee;border-bottom-left-radius:4px;border:1px solid #444}.ia{display:flex;padding:12px;background:#111;border-top:1px solid #333;gap:10px}input{flex:1;padding:12px 15px;border-radius:20px;border:1px solid #444;background:#222;color:#fff;outline:none;font-size:14px}button{padding:0 20px;border-radius:20px;border:none;background:linear-gradient(135deg,#ff4081,#c51162);color:#fff;font-weight:700;font-size:16px;cursor:pointer}button:active{transform:scale(0.95)}</style></head><body><div class="w"><div class="h">🎀 ALYA AI CHAT 🎀</div><div class="cb" id="cb"><div class="m b">හායි මැනික! මම Alya. ඔයාට අද මොනවද දැනගන්න ඕනේ? 🥰 (යටින් Type කරලා Send කරන්න)</div></div><div class="ia"><input type="text" id="i" placeholder="Message Alya..." onkeypress="if(event.key==='Enter') s()"><button onclick="s()">➤</button></div></div><script>function s(){const i=document.getElementById('i');const t=i.value.trim();if(!t)return;window.location.href='https://wa.me/${botNumber}?text='+encodeURIComponent('.alya '+t);}</script></body></html>`;

            const unifiedDataJson = JSON.stringify({
                "response_id": crypto.randomUUID(),
                "sections": [{
                    "view_model": {
                        "primitive": {
                            "__typename": "GenAIaeacdsnwHtmlPrimitive",
                            "payload": appHtml,
                            "trusted_sources": ["wa.me", "whatsapp.com", "api.whatsapp.com"]
                        },
                        "__typename": "GenAISingleLayoutViewModel"
                    }
                }]
            });
            
            const unifiedData = Buffer.from(unifiedDataJson).toString('base64');
            
            let buttonMessage = generateWAMessageFromContent(sender, {
                botForwardedMessage: {
                    message: {
                        richResponseMessage: {
                            messageType: 1,
                            submessages: [{ messageType: 2, messageText: `🎀 *ALYA AI APP* 🎀\n\nClick the Webview below to chat with Alya directly!` }],
                            unifiedResponse: { data: unifiedData },
                            contextInfo: { forwardingScore: 1, isForwarded: true, forwardedAiBotMessageInfo: { botJid: "867051314767696@bot" }, forwardOrigin: 4 }
                        }
                    }
                }
            }, { quoted: msg });

            buttonMessage.message.messageContextInfo = {
                deviceListMetadata: {}, deviceListMetadataVersion: 2,
                botMetadata: {
                    messageDisclaimerText: "", botResponseId: crypto.randomUUID(),
                    verificationMetadata: {
                        proofs: [{
                            version: 1, useCase: 1,
                            signature: "TklYRUwuTWVzc2FnZUJ1aWxkZXJWNC43LVZlcmlmaWNhdGlvblNpZ25hdHVyZS5NZXRhZGF0YeN55YRyad2+ZA==",
                            certificateChain: [
                                "TklYRUwuTWVzc2FnZUJ1aWxkZXJWNC43LUNlcnRpZmljYXRlQ2hhaW4uTWV0YWRhdGEOvtJr968bbpKdZreOTwkk9aPN++XPE60RfuzNLkXXc7LE8BOkJOWRpo2oNXaRJ3uCNJ43HY3A+oetnvHSfcxWqmvvTSrBOI5V1NOD6RMsZ/st1XVPUx83AGps1l5jYBOYzqMNy6un2tToJ2Bt9bXRo29tWLZTu8m7TNY/hISwVpVc5tjSet5U7btPN+dMIx2UvykB1jcbWGsdklheeuz8RXSStNXzeaGvsf1lpZ/ugLE4b2BdmlRNKrY6zLE4qFtRYQoS7axOyQX+4QUyN2m9bfm7urQmn+QRSXJwMO7X5kAJJLbkVGJFt9Pm9VXPwQVrK2aaqiXlpusj+7DfDw00OULmYMmZDTqXM0nUVLxj13z0LhMQoQhhNG8utdUn4uKOFceliTZ/xiP+A54GnX9620641bqw3ctfh9NNXPsTEK8hAUD7FDqUhVntHmoEYYEHq8X1tHHZYP49/f2iezTiE8AUaoZo42/jIWQIKohOGNUib2hEqMkW8NsR8vPihvNuqPc0zKZcl6359YFQdjiiW8kCRD/rsDOr9v1eYLFZKYloFyzFqEgj+jcG/V47elOjShJ5CCPwatXwP6HIloVwtgygFsnOFmCg6Ojoivfoz8Nw1qxFwg5OU2cq/1WbWNELKnaFg4eUWCAIJ/3ZIJsEPkgemZxGhE+hdiNn9dkQYBJs1kx2BxdIkJmQ9vJSKkrMz6lTxZM3IJ9mhmKS6zYdU1ppeAao0/ayte997DQParb/AHLN79g0iW1ad0z8ir5jAl0q3a+UZPTSa4YiSqC2PZ/gfxG5wvL2mKmeKowG0RXjmEp5iNxrni+T/HRLZOoH7y0DQ24nMCPg",
                                "TklYRUwuTWVzc2FnZUJ1aWxkZXJWNC43LUNlcnRpZmljYXRlQ2hhaW4uTWV0YWRhdGHsL0Ccm0ELINFZ2IaBhKaeWnVuh0o6nZLCioCn9xpSADzwIS5VCWO+1eVXT2atJOyf7FYlpB0/JA3Us+aQtekuIkHu/zBXijORZ4ClF4+sF3cSTNg6gY/+6iwLK/zs3bMg+GeJrcI65vXfs95Shxlb2Rd5GRT2/2yBmR6Zkf5QwMJuptUHWtM26WY7/xlkEKGFYDZVqOSylusiOzSALa815zC6dCiHoJNLBEKMlaZZQOk57/+OYoU5zzTaEgLhyvNFHSyAlyLQ3SGFtVHAaJZHSmmSPyJowCOB+92Gkk6SWVMsk6FbU8QJWFtlhzV/W/gZ7WzUlS/AKgN0th9/cq20ToFkW7X9c+rtYavufmuieqFhXgaMD8AGsoN9QC/HzNC9D1nydPfFYEUr9BHVy2nF5gM58Y59r2rT8p5LPARIkUp8g+5DLhyW0tdZFZ1305o4AHCayZnp5rjcU2Xi/c1Qf/djBGakmijlMs4aMzKJYD0c4Q8jdI7sNyd876K2wRD+L6KeD2QB3PtCS4P7BWAl5gh5CJ6ZBrwcaKXZqcSjEwm52MqVCgYZdapAaNYUy/QndttjLOG0wxxwuX1hIhMjPnIKZR1kwnqD5EqlHpilrnojRZvjVGN4zEKmilS8rNstt4HHs/D849W+Q6LRVWiWMs0cT2IugrX+Skxd8En7Gq52UEmuVBrSTpN+UpIu20NsVb9lsvuYh3XO441606tOEY2eKcZJdTtqrOTNqbbTk0zVn1yhbOCvmfctBNDhTwaC5QMi0P9wjU5XI9SBtkdQLizc5oqpoiHeqgb8+aJHVLcbgIJ/KLZKtRWFDfzRNM02Csx4etUUapVd2NA/L0oMs/O5T9sVj9FBJ7q99GWr3PVmxJb36mHZLXC4k1gGN9swE0LtzYsUdT5tUo9ri/hS3W/SM+F1p4Kh4QIgRcG3ciIHGN44bnDh3HDCz0fDnzKYw0bclMxZPctEyJ5gEOPF6OAkjD9dEaRGq/tEPf1k9Aub+v2dEjnfrYWAm4E5Zfhs2Xh0CT0k+SzhgKd0K/46ChJ20G5+blwpIvahvTVS68+aVIX6CwXs4tcVx6FnmVsMOOkIasfaqQLZYbNBkuLoZnQAq4j8yRekrQ=="
                            ]
                        }]
                    }
                }
            };

            await socket.relayMessage(sender, buttonMessage.message, { messageId: buttonMessage.key.id });

        } catch (err) {
            console.error("Webview App Error:", err);
            reply("⚠️ App load error");
        }
    }
};