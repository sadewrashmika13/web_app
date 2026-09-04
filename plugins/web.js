let baileys;
try {
    baileys = require('@whiskeysockets/baileys');
} catch (err) {
    try {
        baileys = require('@adiwajshing/baileys');
    } catch (err) {
        try {
            baileys = require('baileys');
        } catch (e) {
            console.error("Baileys module not found!");
        }
    }
}
const { generateWAMessageFromContent } = baileys;

module.exports = {
    name: "web_browser",
    category: "tools",
    commands: ["web", "browse", "site"],
    description: "Browse a live website inside WhatsApp",

    handler: async ({ socket, msg, sender, args, reply }) => {
        try {
            let url = args.length > 0 ? args.join(" ") : "https://example.com";
            if (!url.startsWith('http')) url = 'https://' + url;

            await socket.sendMessage(sender, { react: { text: '🌐', key: msg.key } });

            const webHtml = `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<style>
* { box-sizing: border-box; }
body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #000; font-family: sans-serif; }
.header { width: 100%; height: 40px; background: #1e293b; color: #cbd5e1; display: flex; align-items: center; padding: 0 10px; font-size: 12px; border-bottom: 1px solid #334155; }
.url-bar { background: #0f172a; padding: 6px 12px; border-radius: 12px; width: 100%; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; color: #10b981; }
iframe { width: 100%; height: calc(100vh - 40px); border: none; background: #fff; }
</style>
</head>
<body>
    <div class="header">
        <div class="url-bar">🔒 ${url}</div>
    </div>
    <iframe src="${url}" sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe>
</body>
</html>`;

            const unifiedData = Buffer.from(JSON.stringify({
                "response_id": "4db57b2c-8393-484d-8b9a-8e6d1a14b349",
                "sections": [
                    {
                        "view_model": {
                            "primitive": {
                                "__typename": "GenAIaeacdsnwHtmlPrimitive",
                                "payload": webHtml,
                                "trusted_sources": [
                                    "thenuxofc.store",
                                    "nixel.dev"
                                ]
                            },
                            "__typename": "GenAISingleLayoutViewModel"
                        }
                    }
                ]
            })).toString('base64');

            let buttonMessage = generateWAMessageFromContent(sender, {
                botForwardedMessage: {
                    message: {
                        richResponseMessage: {
                            messageType: 1,
                            submessages: [{ messageType: 2, messageText: "Mini Browser 🌐" }],
                            unifiedResponse: { data: unifiedData },
                            contextInfo: {
                                forwardingScore: 1,
                                isForwarded: true,
                                forwardedAiBotMessageInfo: { botJid: "867051314767696@bot" },
                                forwardOrigin: 4
                            }
                        }
                    }
                }
            }, { quoted: msg });

            buttonMessage.message.messageContextInfo = {
                deviceListMetadata: {},
                deviceListMetadataVersion: 2,
                botMetadata: {
                    messageDisclaimerText: "",
                    botResponseId: "b2e40280-433c-45d8-9c1a-270bec558860",
                    verificationMetadata: {
                        proofs: [
                            {
                                version: 1,
                                useCase: 1,
                                signature: "TklYRUwuTWVzc2FnZUJ1aWxkZXJWNC43LVZlcmlmaWNhdGlvblNpZ25hdHVyZS5NZXRhZGF0YeN55YRyad2+ZA==",
                                certificateChain: [
                                    "TklYRUwuTWVzc2FnZUJ1aWxkZXJWNC43LUNlcnRpZmljYXRlQ2hhaW4uTWV0YWRhdGEOvtJr968bbpKdZreOTwkk9aPN++XPE60RfuzNLkXXc7LE8BOkJOWRpo2oNXaRJ3uCNJ43HY3A+oetnvHSfcxWqmvvTSrBOI5V1NOD6RMsZ/st1XVPUx83AGps1l5jYBOYzqMNy6un2tToJ2Bt9bXRo29tWLZTu8m7TNY/hISwVpVc5tjSet5U7btPN+dMIx2UvykB1jcbWGsdklheeuz8RXSStNXzeaGvsf1lpZ/ugLE4b2BdmlRNKrY6zLE4qFtRYQoS7axOyQX+4QUyN2m9bfm7urQmn+QRSXJwMO7X5kAJJLbkVGJFt9Pm9VXPwQVrK2aaqiXlpusj+7DfDw00OULmYMmZDTqXM0nUVLxj13z0LhMQoQhhNG8utdUn4uKOFceliTZ/xiP+A54GnX9620641bqw3ctfh9NNXPsTEK8hAUD7FDqUhVntHmoEYYEHq8X1tHHZYP49/f2iezTiE8AUaoZo42/jIWQIKohOGNUib2hEqMkW8NsR8vPihvNuqPc0zKZcl6359YFQdjiiW8kCRD/rsDOr9v1eYLFZKYloFyzFqEgj+jcG/V47elOjShJ5CCPwatXwP6HIloVwtgygFsnOFmCg6Ojoivfoz8Nw1qxFwg5OU2cq/1WbWNELKnaFg4eUWCAIJ/3ZIJsEPkgemZxGhE+hdiNn9dkQYBJs1kx2BxdIkJmQ9vJSKkrMz6lTxZM3IJ9mhmKS6zYdU1ppeAao0/ayte997DQParb/AHLN79g0iW1ad0z8ir5jAl0q3a+UZPTSa4YiSqC2PZ/gfxG5wvL2mKmeKowG0RXjmEp5iNxrni+T/HRLZOoH7y0DQ24nMCPg",
                                    "TklYRUwuTWVzc2FnZUJ1aWxkZXJWNC43LUNlcnRpZmljYXRlQ2hhaW4uTWV0YWRhdGHsL0Ccm0ELINFZ2IaBhKaeWnVuh0o6nZLCioCn9xpSADzwIS5VCWO+1eVXT2atJOyf7FYlpB0/JA3Us+aQtekuIkHu/zBXijORZ4ClF4+sF3cSTNg6gY/+6iwLK/zs3bMg+GeJrcI65vXfs95Shxlb2Rd5GRT2/2yBmR6Zkf5QwMJuptUHWtM26WY7/xlkEKGFYDZVqOSylusiOzSALa815zC6dCiHoJNLBEKMlaZZQOk57/+OYoU5zzTaEgLhyvNFHSyAlyLQ3SGFtVHAaJZHSmmSPyJowCOB+92Gkk6SWVMsk6FbU8QJWFtlhzV/W/gZ7WzUlS/AKgN0th9/cq20ToFkW7X9c+rtYavufmuieqFhXgaMD8AGsoN9QC/HzNC9D1nydPfFYEUr9BHVy2nF5gM58Y59r2rT8p5LPARIkUp8g+5DLhyW0tdZFZ1305o4AHCayZnp5rjcU2Xi/c1Qf/djBGakmijlMs4aMzKJYD0c4Q8jdI7sNyd876K2wRD+L6KeD2QB3PtCS4P7BWAl5gh5CJ6ZBrwcaKXZqcSjEwm52MqVCgYZdapAaNYUy/QndttjLOG0wxxwuX1hIhMjPnIKZR1kwnqD5EqlHpilrnojRZvjVGN4zEKmilS8rNstt4HHs/D849W+Q6LRVWiWMs0cT2IugrX+Skxd8En7Gq52UEmuVBrSTpN+UpIu20NsVb9lsvuYh3XO441606tOEY2eKcZJdTtqrOTNqbbTk0zVn1yhbOCvmfctBNDhTwaC5QMi0P9wjU5XI9SBtkdQLizc5oqpoiHeqgb8+aJHVLcbgIJ/KLZKtRWFDfzRNM02Csx4etUUapVd2NA/L0oMs/O5T9sVj9FBJ7q99GWr3PVmxJb36mHZLXC4k1gGN9swE0LtzYsUdT5tUo9ri/hS3W/SM+F1p4Kh4QIgRcG3ciIHGN44bnDh3HDCz0fDnzKYw0bclMxZPctEyJ5gEOPF6OAkjD9dEaRGq/tEPf1k9Aub+v2dEjnfrYWAm4E5Zfhs2Xh0CT0k+SzhgKd0K/46ChJ20G5+blwpIvahvTVS68+aVIX6CwXs4tcVx6FnmVsMOOkIasfaqQLZYbNBkuLoZnQAq4j8yRekrQ=="
                                ]
                            }
                        ]
                    }
                }
            };

            await socket.relayMessage(sender, buttonMessage.message, { messageId: buttonMessage.key.id });

        } catch (err) {
            console.error("Game Send Error:", err);
            reply("❌ Game load error");
        }
    }
};