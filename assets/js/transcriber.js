async function transcribeAudio(audioFilePath) {
    try {
        console.log(`Transcribing file: ${audioFilePath}`);
        
        const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer YOUR_API_KEY',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ file: audioFilePath, model: 'whisper-1' })
        });
        
        const result = await response.json();
        if (result.text) {
            storeTranscription(result.text);
        }
    } catch (error) {
        console.error('Transcription error:', error);
    }
}

function storeTranscription(transcription) {
    let transcriptions = JSON.parse(localStorage.getItem('transcriptions')) || [];
    transcriptions.push(transcription);
    localStorage.setItem('transcriptions', JSON.stringify(transcriptions));
}
