import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { getSupabase } from "@/lib/supabase";
import Dashboard from "@/pages/Dashboard";
import Editor from "@/pages/Editor";
import FormsList from "@/pages/FormsList";
import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import PublicForm from "@/pages/PublicForm";
import Responses from "@/pages/Responses";

export default function App() {
  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    const { data } = sb.auth.onAuthStateChange(() => {});
    return () => data.subscription.unsubscribe();
  }, []);

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/forms" element={<FormsList />} />
      <Route path="/editor" element={<Editor />} />
      <Route path="/editor/:id/responses" element={<Responses />} />
      <Route path="/editor/:id" element={<Editor />} />
      <Route path="/f/:slug" element={<PublicForm />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
