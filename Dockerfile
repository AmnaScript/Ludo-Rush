# Game server for Hugging Face Spaces (Docker Space). Listens on port 7860.
FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY shared ./shared
COPY server ./server
RUN npm install --workspace @ludo-rush/shared --workspace @ludo-rush/server --include-workspace-root
ENV PORT=7860
EXPOSE 7860
CMD ["npm", "run", "start", "-w", "@ludo-rush/server"]
