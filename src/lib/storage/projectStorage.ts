import * as FileSystem from 'expo-file-system/legacy';
import { parse, stringify } from 'yaml';

import type {
  ProjectRuntime,
  ProjectSummary,
  ProjectYaml,
} from '../project/types';
import { projectFromYaml, projectToYaml } from '../project/createProject';

const PROJECTS_DIR = `${FileSystem.documentDirectory}projects`;
const PROJECT_EXT = '.pfx.yaml';

async function ensureProjectsDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(PROJECTS_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(PROJECTS_DIR, {
      intermediates: true,
    });
  }
}

function projectPath(id: string): string {
  return `${PROJECTS_DIR}/${id}${PROJECT_EXT}`;
}

export async function listProjects(): Promise<ProjectSummary[]> {
  await ensureProjectsDir();
  const entries = await FileSystem.readDirectoryAsync(PROJECTS_DIR);
  const yamlFiles = entries.filter((name) => name.endsWith(PROJECT_EXT));
  const summaries: ProjectSummary[] = [];
  for (const filename of yamlFiles) {
    const content = await FileSystem.readAsStringAsync(
      `${PROJECTS_DIR}/${filename}`,
    );
    const data = parse(content) as ProjectYaml;
    summaries.push({
      id: data.id,
      name: data.name,
      width: data.canvas.width,
      height: data.canvas.height,
      updatedAt: data.meta.updatedAt,
    });
  }
  summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return summaries;
}

export async function loadProject(id: string): Promise<ProjectRuntime> {
  await ensureProjectsDir();
  const content = await FileSystem.readAsStringAsync(projectPath(id));
  const data = parse(content) as ProjectYaml;
  return projectFromYaml(data);
}

export async function saveProject(project: ProjectRuntime): Promise<void> {
  await ensureProjectsDir();
  const data = projectToYaml(project);
  const yaml = stringify(data, { lineWidth: 80 });
  await FileSystem.writeAsStringAsync(projectPath(project.id), yaml);
}

export async function deleteProject(id: string): Promise<void> {
  await ensureProjectsDir();
  await FileSystem.deleteAsync(projectPath(id), { idempotent: true });
}
