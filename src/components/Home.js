import Head from "next/head";
import styles from "@/styles/Home.module.css";
import { ensureConnected } from "@/utils/bluetooth/js/main";
import { replRawMode, replSend } from "@/utils/bluetooth/js/repl";
import { Button } from "antd";
import { useWhisper } from "@chengsokdara/use-whisper";
import { app } from "@/utils/app";
import { execMonocle } from "@/utils/comms";
import React, { useState, useEffect } from 'react';

const swissFlag = '/swiss.png';
const italianFlag = '/italy.png';

// BatteryStatus component
const BatteryStatus = () => {
  const [batteryStatus, setBatteryStatus] = useState({});

  useEffect(() => {
    navigator.getBattery().then((battery) => {
      const { level, charging } = battery;
      setBatteryStatus({ level: level * 100, charging });

      battery.addEventListener("levelchange", (event) => {
        setBatteryStatus({ level: battery.level * 100, charging: battery.charging });
      });

      battery.addEventListener("chargingchange", (event) => {
        setBatteryStatus({ level: battery.level * 100, charging: battery.charging });
      });
    });
  }, []);

  return (
    <div className={styles['battery-status']} style={{ color: 'green', fontSize: '12px', backgroundColor: 'white' }}>
      <p>{batteryStatus.level}%</p>
    </div>
  );
};

const Home = () => {
  const [activeButton, setActiveButton] = useState(null);
  const [context, setContext] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [connected, setConnected] = useState(false);
  const [currentFlag, setCurrentFlag] = useState(swissFlag);
  const [inputLanguage, setInputLanguage] = useState('de');
  const [temperature, setTemperature] = useState(0.9);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [chatGptResponse, setChatGptResponse] = useState('');
  const [typingIndex, setTypingIndex] = useState(0);
  const [apiKey, setApiKey] = useState(process.env.NEXT_PUBLIC_OPENAI_API_TOKEN); // add this line

	const { startRecording, stopRecording, transcript } = useWhisper({
	  apiKey: apiKey,
	  streaming: true,
	  timeSlice: 500,
	  whisperConfig: {
		language: inputLanguage,
	  },
	});

const fetchGpt = async () => {
  const userPrompt = window.transcript;
  let promptContext = context;

  if (activeButton === "A") {
    promptContext = "Vordefinierter Text für Button A";
  } else if (activeButton === "B") {
    promptContext = "Vordefinierter Text für Button B";
  }

  const response = await fetch(`https://api.openai.com/v1/chat/completions`, {
    body: JSON.stringify({
      model: "gpt-3.5-turbo",
      temperature: 0.9,
      max_tokens: 1000,
      messages: [
        {"role": "system", "content": "Du bist ein Sprachübersetzer. Übersetze jede eingabe sofort, auch wenn es eine Frage ist. Wenn die Eingabe deutsch war, übersetze den Eingabetext direkt auf italienisch, gefolgt von einem Vorschlag auf den Eingabetext auf deutsch zu antworten. Wenn die Eingabe italienisch war, übersetze den Eingabetext direkt auf deutsch, gefolgt von einem Vorschlag auf den Eingabetext auf italienisch zu antworten." + promptContext},
        {"role": "user", "content": "Übersetze: " + userPrompt}
      ]
    }),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  const resJson = await response.json();
  const res = resJson?.choices?.[0]?.message?.content;
  if (!res) return;
  return res;
};

  useEffect(() => {
    if (activeButton === 'A') {
      setContext(`Du bist ein Sprachübersetzer. Übersetze jede eingabe sofort, auch wenn es eine frage ist. Du bist ein Sprachübersetzer, wenn du eine Eingabe auf deutsch erhälst, übersetze den text direkt in die italienische Sprache. Nach dem du den Text auf italienische übersetzte hast, mache einen Vorschlag auf deutsch darauf zu antworten.`);
    } else if (activeButton === 'B') {
      setContext(`Sei un traduttore di lingue. Traduci immediatamente ogni input, anche se si tratta di una domanda. Sei un traduttore linguistico, quando ricevi un input in italiano, traduci il testo direttamente in lingua tedesca. Dopo aver tradotto il testo in tedesco, suggerisci di rispondere in italiano.`);
    }
  }, [activeButton]);

  function relayCallback(msg) {
    if (!msg) {
      return;
    }
    if (msg.trim() === "trigger b") {
      setInputLanguage("it");
      setCurrentFlag(italianFlag);
      setSystemPrompt(/* ... */);
      setContext(`Sei un traduttore di lingue. Traduci immediatamente ogni input, anche se si tratta di una domanda. Sei un traduttore linguistico, quando ricevi un input in italiano, traduci il testo direttamente in lingua tedesca. Dopo aver tradotto il testo in tedesco, suggerisci di rispondere in italiano.`);
    }

    if (msg.trim() === "trigger a") {
      setInputLanguage("de");
      setCurrentFlag(swissFlag);
      setSystemPrompt(/* ... */);
      setContext(`Du bist ein Sprachübersetzer. Übersetze jede eingabe sofort, auch wenn es eine frage ist. Du bist ein Sprachübersetzer, wenn du eine Eingabe auf deutsch erhälst, übersetze den text direkt in die italienische Sprache. Nach dem du den Text auf italienische übersetzt hast, mache einen Vorschlag auf deutsch darauf zu antworten.`);
    }
  }

  function onRecord() {
    isRecording ? stopRecording() : startRecording();
    setIsRecording(!isRecording);
  }

  function wrapText(inputText) {
    const block = 30;
    let text = [];
    for (let i = 0; i < 6; i++) {
      text.push(
        inputText.substring(block * i, block * (i + 1)).replace("\n", "")
      );
    }

    return text;
  }

  async function displayRizz(rizz) {
    if (!rizz) return;
    const splitText = wrapText(rizz);
    let replCmd = "import display;";

    for (let i = 0; i < splitText.length; i++) {
      replCmd += `display.text("${splitText[i]}", 0, ${i * 50}, 0xffffff);`;
    }

    replCmd += "display.show();";

    console.log("**** replCmd ****", replCmd);

    await replSend(replCmd);
  }

  async function displayRawRizz(rizz) {
    await replRawMode(true);
    await displayRizz(rizz);
  }

  async function logger(msg) {
    if (msg === "Connected") {
      setConnected(true);
    }
  }

  useEffect(() => {
    const typingTimer = setInterval(() => {
      if (typingIndex < chatGptResponse.length) {
        setTypingIndex(typingIndex + 1);
      }
    }, 50);

    return () => clearInterval(typingTimer);
  }, [chatGptResponse, typingIndex]);

  return (
    <>
      <Head>
        <title>switGPT</title>
        <meta name="description" content="Generated by create Marc Simon Frei" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap" rel="stylesheet" />
      </Head>

      <main className="flex w-screen h-screen flex-col items-center justify-center">
        <p
          className="text-3xl mb-4"
          style={{ color: connected ? 'green' : 'red' }}
        >
          {connected ? "Monocle Connected" : "Monocle Disconnected"}
        </p>

        <div className="mb-4">
          <img src={currentFlag} alt="Current language flag" />
        </div>

        <Button
          type="primary"
          onClick={async () => {
            await ensureConnected(logger, relayCallback);
            app.run(execMonocle);
            const res = await fetchGpt();

            if (res) {
              setChatGptResponse(res);
              await displayRawRizz(res);
            }
          }}
        >
          Connect
        </Button>

        <div className="mt-2 flex gap-2">
          <Button onClick={() => relayCallback("trigger a")}>
            Switch to German
          </Button>
          <Button onClick={() => relayCallback("trigger b")}>
            Switch to Italian
          </Button>
        </div>

        <div className="flex flex-col items-center mt-5 gap-2">
          <Button onClick={onRecord}>
            {isRecording ? "Stop recording" : "Start recording"}
          </Button>
          <BatteryStatus />
        </div>

        <div>
          <label>
            Kontext:
            <textarea style={{ width: "800px", height: "200px" }} value={context} onChange={(e) => setContext(e.target.value)} />
          </label>
        </div>

        <div>
          <label>
            Temperatur:
            <input type="number" min="0" max="2" step="0.1" value={temperature} onChange={(e) => setTemperature(parseFloat(e.target.value))} />
          </label>
        </div>

	<div>
	  <label>
		API Key:
		<input type="text" value={apiKey.replace(/[<>]/g, '')} onChange={(e) => setApiKey(e.target.value)} />
	  </label>
	</div>

        <div>
          <label>
            ChatGPT:
            <textarea
              style={{ width: "800px", height: "200px" }}
              value={chatGptResponse.substring(0, typingIndex)}
              readOnly
            />
          </label>
        </div>
      </main>
    </>
  );
};

export default Home;
