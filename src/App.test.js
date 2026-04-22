import { render, screen } from "@testing-library/react";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";

test("renders ecoscan home content", () => {
  render(
    <AuthProvider>
      <App />
    </AuthProvider>
  );
  expect(
    screen.getByRole("heading", { name: /scannez\.\s*recyclez\.\s*impactez\./i })
  ).toBeInTheDocument();
  expect(screen.getByText(/recyclage intelligent/i)).toBeInTheDocument();
});
