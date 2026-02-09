import { createBrowserRouter, RouterProvider } from "react-router";
import { HomePage } from "./pages/HomePage";
import { StoryboardInitPage } from "./pages/StoryboardInitPage";
import { NotFoundPage } from "./pages/NotFoundPage";

const router = createBrowserRouter([
  {
    path: "/",
    Component: HomePage,
  },
  {
    path: "/storyboard/:storyboardId",
    Component: StoryboardInitPage,
  },
  {
    path: "*",
    Component: NotFoundPage,
  }
]);

export const App = () => <RouterProvider router={router} />;
