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
const WORKING_EXT = '.pfx.working.yaml';
const BACKUP_EXT = '.pfx.bak.yaml';
const TMP_EXT = '.tmp';

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

function workingPath(id: string): string {
  return `${PROJECTS_DIR}/${id}${WORKING_EXT}`;
}

function backupPath(id: string): string {
  return `${PROJECTS_DIR}/${id}${BACKUP_EXT}`;
}

function tmpPath(path: string): string {
  return `${path}${TMP_EXT}`;
}

async function moveReplaceAsync(from: string, to: string): Promise<void> {
  await FileSystem.deleteAsync(to, { idempotent: true });
  await FileSystem.moveAsync({ from, to });
}

export async function cleanupTmpFiles(): Promise<void> {
  await ensureProjectsDir();
  const entries = await FileSystem.readDirectoryAsync(PROJECTS_DIR);
  const tmpFiles = entries.filter((name) => name.endsWith(TMP_EXT));
  await Promise.all(
    tmpFiles.map((name) =>
      FileSystem.deleteAsync(`${PROJECTS_DIR}/${name}`, {
        idempotent: true,
      }),
    ),
  );
}

export async function listProjects(): Promise<ProjectSummary[]> {
  await cleanupTmpFiles();
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

export async function saveWorkingCopy(
  project: ProjectRuntime,
): Promise<void> {
  await ensureProjectsDir();
  const data = projectToYaml(project);
  const yaml = stringify(data, { lineWidth: 80 });
  const destination = workingPath(project.id);
  const tmp = tmpPath(destination);
  await FileSystem.writeAsStringAsync(tmp, yaml);
  await moveReplaceAsync(tmp, destination);
}

export async function saveProjectExplicit(
  project: ProjectRuntime,
): Promise<void> {
  await ensureProjectsDir();
  const data = projectToYaml(project);
  const yaml = stringify(data, { lineWidth: 80 });
  const canonical = projectPath(project.id);
  const tmp = tmpPath(canonical);
  const backup = backupPath(project.id);
  await FileSystem.writeAsStringAsync(tmp, yaml);
  const canonicalInfo = await FileSystem.getInfoAsync(canonical);
  if (canonicalInfo.exists) {
    await moveReplaceAsync(canonical, backup);
  }
  await moveReplaceAsync(tmp, canonical);
  await deleteWorkingCopy(project.id);
  await FileSystem.deleteAsync(backup, { idempotent: true });
}

export async function loadWorkingCopy(id: string): Promise<ProjectRuntime> {
  await ensureProjectsDir();
  const content = await FileSystem.readAsStringAsync(workingPath(id));
  const data = parse(content) as ProjectYaml;
  return projectFromYaml(data);
}

export async function workingCopyExists(id: string): Promise<boolean> {
  await ensureProjectsDir();
  const info = await FileSystem.getInfoAsync(workingPath(id));
  return info.exists;
}

export async function deleteWorkingCopy(id: string): Promise<void> {
  await ensureProjectsDir();
  await FileSystem.deleteAsync(workingPath(id), { idempotent: true });
}

export async function deleteProject(id: string): Promise<void> {
  await ensureProjectsDir();
  await FileSystem.deleteAsync(projectPath(id), { idempotent: true });
}
