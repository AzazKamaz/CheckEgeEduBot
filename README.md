[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy)

## Telegram bot for checking check.ege.edu.ru

Bot provided as-is and licensed with MPL-2.0.

For running you need some env variables:

Variable          | Description
--------          | -----------
`$TG_TOKEN`       | Telegram bot token from t.me/BotFather
`$WEBHOOK_DOMAIN` | [optional] Domain on which webhook is served
`$WEBHOOK_PATH`   | [optional] Path on which webhook is served (default is `/[uuid4]`)
`$PORT`           | [optional] Port on which handle webhook (set by Heroku, default is `8000`)
`$REDISCLOUD_URL` | [optional] Url for redis connection (addon Redis Cloud on Heroku)
