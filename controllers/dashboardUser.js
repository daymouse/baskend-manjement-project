import { supabase } from "../supabaseClient.js";

export const getHomeDashboard = async (req, res) => {
  const userId = req.user?.user_id;
  console.log("📩 [Dashboard] userId:", userId);

  try {
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // 1️⃣ Hitung jumlah proyek yang dipimpin
    const { count: projectsLed, error: ledError } = await supabase
      .from('projects')
      .select('project_id', { count: 'exact' })
      .eq('created_by', userId);
    if (ledError) throw ledError;

    // 2️⃣ Hitung jumlah card yang ditugaskan ke user
    const { count: tasksOwned, error: tasksError } = await supabase
      .from('card_assignments')
      .select('assignment_id', { count: 'exact' })
      .eq('user_id', userId);
    if (tasksError) throw tasksError;

    // 3️⃣ Hitung jumlah proyek yang diikuti
    const { count: projectsJoined, error: joinedError } = await supabase
      .from('project_members')
      .select('member_id', { count: 'exact' })
      .eq('user_id', userId);
    if (joinedError) throw joinedError;

    // 4️⃣ Ambil daftar proyek yang user buat
    const { data: createdProjects, error: createdError } = await supabase
      .from('projects')
      .select('project_id, project_name, status, created_at, deadline')
      .eq('created_by', userId);

    if (createdError) throw createdError;

    // 5️⃣ Ambil daftar proyek yang user ikuti
    const { data: joinedProjects, error: joinedProjError } = await supabase
      .from('project_members')
      .select('projects(project_id, project_name, status, created_at, deadline)')
      .eq('user_id', userId);

    if (joinedProjError) throw joinedProjError;

    // Flatten proyek gabungan
    const joined = (joinedProjects || []).map((j) => j.projects);
    const allProjects = [
      ...(createdProjects || []),
      ...joined.filter(Boolean),
    ];

    // Hilangkan duplikat project_id
    const uniqueProjects = Object.values(
      allProjects.reduce((acc, p) => {
        acc[p.project_id] = p;
        return acc;
      }, {})
    );

    // 6️⃣ Response flat JSON
    console.log("✅ [Dashboard] Response OK dikirim ke client");
        res.json({
        projects_led: projectsLed || 0,
        tasks_owned: tasksOwned || 0,
        projects_joined: projectsJoined || 0,
        projects: uniqueProjects.map((p) => ({
            id: p.project_id,
            name: p.project_name,
            status: p.status,
            created_at: p.created_at,
            deadline: p.deadline,
        })),
        });
  } catch (error) {
    console.error("🔥 [Dashboard Error]", error);
    res.status(500).json({ error: error.message || "Something went wrong" });
  }
};
