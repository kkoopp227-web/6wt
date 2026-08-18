window.enmity.plugins.registerPlugin({
  name: "FakeVoice",
  version: "1.0.0",
  description: "أرفق ملف صوتي واكتب /voice ليرسل كرسالة صوتية",
  color: "#ff0000",
  onStart: function() {
    try {
      const { patcher, modules } = window.enmity;
      
      // باتش لإرسال الرسائل النصية المرفقة
      const MessageActions = modules.getByProps("sendMessage");
      if (MessageActions) {
        patcher.before("FakeVoice", MessageActions, "sendMessage", function(args) {
          let message = args[1];
          if (message && typeof message.content === "string" && message.content.trim().startsWith("/voice")) {
            message.content = message.content.replace("/voice", "").trim();
            message.flags = 8192; // علامة الرسالة الصوتية
          }
        });
      }

      // باتش لرفع الملفات (المهم للملفات الصوتية المرفقة)
      const UploadActions = modules.getByProps("uploadFiles") || modules.getByProps("upload");
      if (UploadActions) {
        const targetMethod = UploadActions.uploadFiles ? "uploadFiles" : "upload";
        patcher.before("FakeVoice", UploadActions, targetMethod, function(args) {
          let options = args[0]; // المتغير الأول عادة يحتوي على الخيارات
          if (options && options.parsedMessage) {
            let message = options.parsedMessage;
            if (typeof message.content === "string" && message.content.trim().startsWith("/voice")) {
              message.content = message.content.replace("/voice", "").trim();
              message.flags = 8192;
              
              // محاولة وضع موجة صوتية وهمية لكي يقبلها ديسكورد
              if (options.uploads && options.uploads.length > 0) {
                options.uploads.forEach(u => {
                  u.waveform = "Cg=="; // موجة وهمية
                  u.duration_secs = 5.0; // مدة وهمية 5 ثوان
                });
              }
            }
          }
        });
      }
    } catch (e) {
      console.log("FakeVoice error:", e);
    }
  },
  onStop: function() {
    window.enmity.patcher.unpatchAll("FakeVoice");
  }
});
