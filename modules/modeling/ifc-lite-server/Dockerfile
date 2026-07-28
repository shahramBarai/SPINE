# ghcr.io/ltplus-ag/ifc-lite-server isn't actually publicly pullable (the
# registry returns an auth challenge distinct from "not found", and the
# GitHub Packages page 404s) despite being referenced in ifc-lite's own docs.
# @ifc-lite/server-bin is the same team's own documented fallback: it
# downloads a checksummed prebuilt binary from GitHub Releases (a channel we
# confirmed does work) instead of a container registry. This just bakes that
# binary into an image so the rest of the repo can keep treating it as a
# normal docker-compose service.
FROM node:20-alpine

WORKDIR /app
COPY package.json .

# Postinstall's own download is best-effort (won't fail `npm install` on
# failure), so fetch again explicitly here - this fails the build if the
# platform binary can't be downloaded/verified, instead of shipping an image
# that only breaks once a container starts from it.
RUN npm install --omit=dev && node node_modules/.bin/ifc-lite-server download

ENV CACHE_DIR=/app/cache
EXPOSE 8080

CMD ["node", "node_modules/.bin/ifc-lite-server"]
