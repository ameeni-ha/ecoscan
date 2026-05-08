# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Run full project (API + MongoDB + React)

### 1) MongoDB

Install and run **[MongoDB Community Server](https://www.mongodb.com/try/download/community)** locally (ensure the Windows service listens on port **27017**), **or** use **[MongoDB Atlas](https://www.mongodb.com/cloud/atlas)** and copy your connection string.

Copy `backend/api/.env.example` to `backend/api/.env` and set **`MONGO_URI`** (required in production).

In development, if `MONGO_URI` is omitted, the API connects to **`mongodb://127.0.0.1:27017/ecoscan`**.

### 2) API (Express)

Keep this running **in its own terminal** (the React UI does not start the API automatically):

```bash
npm run api
```

The API listens on **`http://127.0.0.1:4000`**. Health check: **`http://127.0.0.1:4000/api/health`**.

### 3) React app

In another terminal:

```bash
npm start
```

Open `http://localhost:3000` (or the port CRA prints if 3000 is busy).

During development the app proxies API calls to port **4000** via **`package.json` → `proxy`**, so **CORS stays simple** while `npm run api` uses the **default URL** (`REACT_APP_API_URL` is optional locally). For a hosted front-end, build with **`REACT_APP_API_URL`** pointing at your public API (e.g. `https://api.example.com/api`).

### Notes

- If the primary **`MONGO_URI`** fails during development (e.g. Atlas offline), set **`LOCAL_MONGO_URI`** to a reachable instance in `backend/api/.env`, or the API may fall back to an in-memory MongoDB for development only.

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)
