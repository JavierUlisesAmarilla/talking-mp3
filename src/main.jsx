import './main.css';
import { TalkingHead } from "./modules/talkinghead";

let head; // TalkingHead instance
let audio; // Audio object

// Make a transcription of an audio file using OpenAI's Whisper API
async function loadAudio(file) {

  try {
    const nodeJSON = document.getElementById('json');
    nodeJSON.value = "Please wait...";

    const nodePlay = document.getElementById('play');
    nodePlay.disabled = true;

    // OpenAI Whisper request
    const form = new FormData();
    form.append("file", file);
    form.append("model", "whisper-1");
    form.append("language", "en");
    form.append("response_format", "verbose_json");
    form.append("timestamp_granularities[]", "word");
    form.append("timestamp_granularities[]", "segment");

    // NOTE: Never put your API key in a client-side code unless you know
    //       that you are the only one to have access to that code!
    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      body: form,
      headers: {
        "Authorization": `Bearer ${import.meta.env.VITE_OPEN_AI_KEY}` // <- Change this
      }
    });

    if (response.ok) {

      const json = await response.json();
      nodeJSON.value = JSON.stringify(json, null, 4);

      // Fetch audio
      if (json.words && json.words.length) {

        var reader = new FileReader();
        reader.readAsArrayBuffer(file);

        reader.onload = async readerEvent => {
          let arraybuffer = readerEvent.target.result;
          let audiobuffer = await head.audioCtx.decodeAudioData(arraybuffer);

          // TalkingHead audio object
          audio = {
            audio: audiobuffer,
            words: [],
            wtimes: [],
            wdurations: [],
            markers: [],
            mtimes: []
          };

          // Add words to the audio object
          json.words.forEach(x => {
            audio.words.push(x.word);
            audio.wtimes.push(1000 * x.start - 150);
            audio.wdurations.push(1000 * (x.end - x.start));
          });


          // Callback function to make the avatar look at the camera
          const startSegment = async () => {
            head.lookAtCamera(500);
            head.speakWithHands();
          };

          // Add timed callback markers to the audio object
          json.segments.forEach(x => {
            if (x.start > 2 && x.text.length > 10) {
              audio.markers.push(startSegment);
              audio.mtimes.push(1000 * x.start - 1000);
            }
          });

          // Enable play button
          nodePlay.disabled = false;
        }
      }

    } else {
      nodeJSON.value = 'Error: ' + response.status + ' ' + response.statusText;
      console.log(response);
    }

  } catch (error) {
    console.log(error);
  }
}

document.addEventListener('DOMContentLoaded', async function () {

  // Instantiate the class
  // NOTE: Text-to-speech not initialized
  const nodeAvatar = document.getElementById('avatar');
  head = new TalkingHead(nodeAvatar, {
    ttsEndpoint: "https://eu-texttospeech.googleapis.com/v1beta1/text:synthesize",
    cameraView: "head"
  });

  // Load and show the avatar
  const nodeLoading = document.getElementById('loading');
  try {
    await head.showAvatar({
      url: 'https://models.readyplayer.me/64bfa15f0e72c63d7c3934a6.glb?morphTargets=ARKit,Oculus+Visemes,mouthOpen,mouthSmile,eyesClosed,eyesLookUp,eyesLookDown&textureSizeLimit=1024&textureFormat=png',
      body: 'F',
      avatarMood: 'neutral',
      lipsyncLang: 'en'
    }, (ev) => {
      if (ev.lengthComputable) {
        let val = Math.min(100, Math.round(ev.loaded / ev.total * 100));
        nodeLoading.textContent = "Loading " + val + "%";
      }
    });
    nodeLoading.style.display = 'none';
  } catch (error) {
    console.log(error);
    nodeLoading.textContent = error.toString();
  }

  // File changed
  const nodeLoad = document.getElementById('load');
  nodeLoad.addEventListener('change', function (ev) {
    let file = ev.target.files[0];
    loadAudio(file);
  });

  // Play button clicked
  const nodePlay = document.getElementById('play');
  nodePlay.addEventListener('click', function () {
    if (audio) {
      head.speakAudio(audio);
    }
  });

});
