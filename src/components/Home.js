import Head from "next/head";
import { Inter } from "next/font/google";
import styles from "@/styles/Home.module.css";
import { useState, useEffect } from "react";
import { ensureConnected } from "@/utils/bluetooth/js/main";
import { replRawMode, replSend } from "@/utils/bluetooth/js/repl";
import { Button } from "antd";
import { useWhisper } from "@chengsokdara/use-whisper";
import { app } from "@/utils/app";
import { execMonocle } from "@/utils/comms";
const swissFlag = '/swiss.png';
const italianFlag = '/italy.png';

const inter = Inter({ subsets: ["latin"] });

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
  const [connected, setConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [inputLanguage, setInputLanguage] = useState("de");
  const [currentFlag, setCurrentFlag] = useState(swissFlag);
  const [systemPrompt, setSystemPrompt] = useState(`
    Du bist in hilfreicher Sprachuebersetzer.
    Du uebersetzt alles ohne umschweifungen direkt von der Sprache deutsch auf italienisch. 
    Du uebersetz direkt alle Eingaben die du erhälst auf italienisch, danach folgt einen Voschlag auf deutsch zu antworten.
	Wenn du jeweils nach dem übersetzen einen Vorschlag zum antworten machts, dann beginne den Satz immer mit "Vorschlag:".
  `);
  

  const { startRecording, stopRecording, transcript } = useWhisper({
    apiKey: process.env.NEXT_PUBLIC_OPENAI_API_TOKEN,
    streaming: true,
    timeSlice: 500,
    whisperConfig: {
      language: inputLanguage,
    },
  });

	const fetchGpt = async () => {
	 const userPrompt = window.transcript;
	 const response = await fetch(`https://api.openai.com/v1/completions`, {
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        prompt:
          systemPrompt +
          "\ntranscript: " +
          userPrompt +
          "\noptimal interviewee's response: ",
        temperature: 0.2,
        max_tokens: 1000,
        frequency_penalty: 0,
        presence_penalty: 0,
      }),
      headers: {
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_OPENAI_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    const resJson = await response.json();
    const res = resJson?.choices?.[0]?.text;
    if (!res) return;
    return res;  // Gibt das Ergebnis der Anfrage zurück.
 };

  useEffect(() => {
    window.transcript = transcript.text;
    fetchGpt();
  }, [transcript.text]);

  function relayCallback(msg) {
    if (!msg) {
      return;
    }
    if (msg.trim() === "trigger b") {
      setInputLanguage("it");
      setCurrentFlag(italianFlag);
      setSystemPrompt(`
        Du bist in hilfreicher Sprachuebersetzer.
        Du uebersetzt alles ohne umschweifungen direkt von der Sprache italienisch auf deutsch. 
        Du uebersetz direkt alle Eingaben die du erhälst auf deutsch, danach folgt einen Voschlag auf italienisch zu antworten.
		Wenn du jeweils nach dem übersetzen einen Vorschlag zum antworten machts, dann beginne den Satz immer mit "Vorschlag:".
      `);
    }

    if (msg.trim() === "trigger a") {
      setInputLanguage("de");
	  setCurrentFlag(swissFlag);
      setSystemPrompt(`
        Du bist in hilfreicher Sprachuebersetzer.
        Du uebersetzt alles ohne umschweifungen direkt von der Sprache deutsch auf italienisch. 
        Du uebersetz direkt alle Eingaben die du erhälst auf italienisch, danach folgt einen Voschlag auf deutsch zu antworten.
		Wenn du jeweils nach dem übersetzen einen Vorschlag zum antworten machts, dann beginne den Satz immer mit "Vorschlag:".

      `);
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

return (
    <>
      <Head>
        <title>switGPT</title>
        <meta name="description" content="Generated by create Marc Simon Frei" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
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
        {transcript.text}
		<Button
		  type="primary"
		  onClick={async () => {
			await ensureConnected(logger, relayCallback);
			app.run(execMonocle);
			const res = await fetchGpt();  // Ruft die Funktion fetchGpt auf und speichert das Ergebnis.
			if (res) {
			  await displayRawRizz(res);  // Wenn das Ergebnis existiert, geben Sie es an die Funktion displayRawRizz weiter.
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
		{/* Neuer Code endet hier */}

		<div className="flex flex-col items-center mt-5 gap-2">
		  <Button onClick={onRecord}>
			{isRecording ? "Stop recording" : "Start recording"}
		  </Button>
		  <BatteryStatus />
		</div>
		</main>
    </>
  );
};

export default Home;

