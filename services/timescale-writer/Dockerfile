FROM node:20-slim

WORKDIR /app

COPY ./services/timescale-writer .

RUN npm install

CMD [ "npm", "run", "dev" ]