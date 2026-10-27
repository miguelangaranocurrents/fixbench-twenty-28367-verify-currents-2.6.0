import { expect, test } from '../lib/fixtures/screenshot';
import { postBackendGraphQL } from '../lib/requests/post-backend-graphql';

// Tim Apple, the workspace member the e2e user signs in as.
const TIM_WORKSPACE_MEMBER_ID = '20202020-0687-4c41-b707-ed1bfca972a7';

test('Task stays in its group after adding a relation', async ({ page }) => {
  const title = `Grouped task ${Date.now()}`;

  await page.goto('/objects/tasks');

  const created = await postBackendGraphQL<{ createTask: { id: string } }>({
    page,
    data: {
      query: `mutation CreateTask($input: TaskCreateInput!) {
        createTask(data: $input) { id }
      }`,
      variables: {
        input: { title, status: 'TODO', assigneeId: TIM_WORKSPACE_MEMBER_ID },
      },
    },
  });
  expect(created.body.errors).toBeUndefined();
  const taskId = created.body.data?.createTask.id;
  expect(taskId).toBeTruthy();

  await page.reload();
  // The view picker reads "<current view> · <record count>".
  await page.getByRole('button', { name: / · [\d,]+$/ }).first().click();
  await page.getByText('Assigned to Me', { exact: true }).click();

  const taskCells = page.locator(`[data-record-table-record-id="${taskId}"]`);
  await expect(page.getByText(title, { exact: true })).toBeVisible();

  // The Relations cell is the one in the same column as the "Relations" header.
  const header = await page
    .getByText('Relations', { exact: true })
    .first()
    .boundingBox();
  expect(header).not.toBeNull();
  let relationsCell = taskCells.first();
  for (const cell of await taskCells.all()) {
    const box = await cell.boundingBox();
    if (box && header && header.x + 4 >= box.x && header.x + 4 < box.x + box.width) {
      relationsCell = cell;
      break;
    }
  }

  await relationsCell.click();
  await page.keyboard.type('Microsoft');
  const relationSaved = page.waitForResponse(
    (response) =>
      response.url().includes('/graphql') &&
      /createTaskTargets/i.test(response.request().postData() ?? ''),
  );
  await page.getByRole('option', { name: /Microsoft/ }).first().click();
  await relationSaved;
  await page.keyboard.press('Escape');
  // Give the table time to apply the saved relation before checking the row.
  await page.waitForTimeout(2000);

  await expect(page.getByText(title, { exact: true })).toBeVisible();
  await expect(relationsCell).toContainText('Microsoft');
});
