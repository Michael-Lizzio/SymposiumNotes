document.addEventListener("DOMContentLoaded", () => {
    let transcriptions = JSON.parse(localStorage.getItem("transcriptions")) || [];

    function transcribeAudio(audioFile) {
        console.log(`Processing: ${audioFile}`);
        transcriptions.push(`Processed: ${audioFile}`);
        localStorage.setItem("transcriptions", JSON.stringify(transcriptions));
    }

    window.addEventListener("message", (event) => {
        if (event.data.file) {
            console.log(`Received message: ${event.data.file}`);
            transcribeAudio(event.data.file);
        }
    });
});
