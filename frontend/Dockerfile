FROM node:20-alpine
WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

# Build the production app
RUN npm run build

# Expose port
EXPOSE 3000

# Start production server
CMD ["npm", "run", "start"]
