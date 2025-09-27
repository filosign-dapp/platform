import env from "../../env";

const BOT_TOKEN = env.TG_ANALYTICS_BOT_TOKEN;
const GROUP_ID = env.TG_ANALYTICS_BOT_GROUP_ID;

function log(message?: any, ...optionalParams: any[]) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

  const text = `${require("os").hostname()}:${process.pid}\n${[
    message,
    ...optionalParams,
  ]
    .map((j) => j.toString())
    .join(" ")}
    `;

  const body = {
    chat_id: GROUP_ID,
    text,
    // parse_mode: "HTML",
    disable_web_page_preview: true,
  };
  fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const analytics = {
  log,
};

export default analytics;
