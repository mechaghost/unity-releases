import type { Client } from "pg";
import { readFileSync } from "node:fs";
import { parseIssueReport } from "../../src/lib/parsers/issue-report";

export async function seedIssueReportFixture(client: Client) {
  const report=parseIssueReport(readFileSync("tests/fixtures/issue-reports/customer.html","utf8"),"UUM-145761");
  await client.query(`INSERT INTO issue_reports(issue_id,source_url,canonical_url,title,description,content_available,last_outcome,last_success_at,next_attempt_at)
    VALUES ($1,$2,$2,$3,$4,true,'ready',now(),now()+interval '7 days')`,
    [report.issueId,"https://issuetracker.unity.com/issues/23181/linux-editor-tofiledescriptor",report.title,report.description]);
  await client.query(`INSERT INTO unity_releases(version,major_line,minor_line,patch,suffix_channel,suffix_number,stream,release_date,release_page_url,parser_version,normalized_sha256)
    VALUES ('6000.3.21f1','6000','6000.3',21,'f',1,'LTS','2026-08-12','https://unity.com/releases/editor/whats-new/6000.3.21f1','fixture','report-release21'),
           ('6000.3.23f1','6000','6000.3',23,'f',1,'LTS','2026-08-26','https://unity.com/releases/editor/whats-new/6000.3.23f1','fixture','report-release23')`);
  await client.query(`INSERT INTO release_note_items(unity_release_id,version,major_line,minor_line,stream,release_date,section,area,impact_kind,risk_level,body,issue_ids,issue_links_json,source_url,source_order,parser_version,normalized_sha256)
    SELECT id,version,major_line,minor_line,stream,release_date,'Changes','Mono','change','info','Remove assertions from ToFileDescriptor',
      ARRAY['UUM-145761'],'[{"id":"UUM-145761","url":"https://issuetracker.unity.com/api/v1.0/redirects/guid/UUM-145761"}]',
      release_page_url,1,'fixture','report-note' FROM unity_releases WHERE version='6000.3.23f1'`);
  // Synthetic reports exercise compare's custom known-issue and package rows.
  for (const [id,title,section,impact,pkg] of [
    ['UUM-90001','Fixture known-issue report','Known Issues','known_issue',null],
    ['UUM-90002','Fixture package report','Package updates','package_change','com.fixture.package']
  ]) {
    await client.query(`INSERT INTO issue_reports(issue_id,source_url,canonical_url,title,description,content_available,last_outcome,last_success_at)
      VALUES ($1,'https://issuetracker.unity.com/','https://issuetracker.unity.com/',$2,'Synthetic report context for browser acceptance.',true,'ready',now())`,[id,title]);
    await client.query(`INSERT INTO release_note_items(unity_release_id,version,major_line,minor_line,stream,release_date,section,area,impact_kind,risk_level,body,issue_ids,package_names,source_url,source_order,parser_version,normalized_sha256)
      SELECT id,version,major_line,minor_line,stream,release_date,$1,'Editor',$2,'info',$3,ARRAY[$4]::text[],$5::text[],release_page_url,2,'fixture',$4
      FROM unity_releases WHERE version='6000.3.23f1'`,[section,impact,title,id,pkg?[pkg]:[]]);
  }
}
