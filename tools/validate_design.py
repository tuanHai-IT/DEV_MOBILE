"""Validate referential integrity, financial guards and Android/export consistency."""
import json
from pathlib import Path
import sqlite3
import re
import unittest
import xml.etree.ElementTree as ET
import zipfile

ROOT=Path(__file__).resolve().parents[1]

class DesignTests(unittest.TestCase):
    def setUp(self):
        self.db=sqlite3.connect(':memory:')
        self.db.executescript((ROOT/'database/schema.sql').read_text(encoding='utf-8'))
        for name in ['admin','buyer','seller','stranger']:
            self.db.execute("INSERT INTO users (id,display_name,email,role,status,created_at) VALUES (?,?,?,'MEMBER','ACTIVE','2026-01-01')",(name,name,name+'@example.test'))
        for name in ['buyer','seller']:
            self.db.execute("INSERT INTO verifications (id,user_id,status,submitted_at) VALUES (?,?,'VERIFIED','2026-01-01')",('v-'+name,name))
    def tearDown(self): self.db.close()
    def order(self):
        self.db.execute("INSERT INTO orders (id,buyer_id,seller_id,delivery_snapshot,status,subtotal_vnd,shipping_vnd,total_vnd,created_at) VALUES ('order','buyer','seller','snapshot','PENDING_PAYMENT',120000,25000,145000,'2026-01-01')")
    def test_domain_and_sql_match_exactly_twenty(self):
        schema=json.loads((ROOT/'docs/domain-model.json').read_text(encoding='utf-8'))
        self.assertEqual(len(schema),20)
        tables={r[0] for r in self.db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        self.assertEqual(tables,{e['table'] for e in schema})
        for entity in schema:
            self.assertEqual([r[1] for r in self.db.execute('PRAGMA table_info('+entity['table']+')')],[f['name'] for f in entity['fields']])
            self.assertTrue((ROOT/'app/src/main/java/com/example/recyclingshareapp/model'/(entity['name']+'.java')).exists())
    def test_unverified_buyer_and_seller_rejected(self):
        for party in ['buyer','seller']:
            self.db.execute("UPDATE verifications SET status='PENDING' WHERE user_id=?",(party,))
            with self.assertRaises(sqlite3.IntegrityError): self.order()
            self.db.execute("UPDATE verifications SET status='VERIFIED' WHERE user_id=?",(party,))
        self.order()
    def test_expired_verification_rejected(self):
        self.db.execute("UPDATE verifications SET expires_at='2000-01-01T00:00:00Z' WHERE user_id='buyer'")
        with self.assertRaises(sqlite3.IntegrityError): self.order()
    def test_suspended_user_rejected(self):
        self.db.execute("UPDATE users SET status='SUSPENDED' WHERE id='seller'")
        with self.assertRaises(sqlite3.IntegrityError): self.order()
    def test_total_must_equal_snapshot_components(self):
        self.order()
        with self.assertRaises(sqlite3.IntegrityError): self.db.execute("UPDATE orders SET total_vnd=1")
    def test_only_one_successful_charge_per_order(self):
        self.order()
        statement="INSERT INTO payments(id,order_id,kind,provider,idempotency_key,amount_vnd,currency,status,created_at) VALUES (?,'order','CHARGE','MOMO',?,145000,'VND','SUCCEEDED','2026-01-01')"
        self.db.execute(statement,('p1','key1'))
        with self.assertRaises(sqlite3.IntegrityError): self.db.execute(statement,('p2','key2'))
    def test_review_requires_completed_order_and_participants(self):
        self.order()
        statement="INSERT INTO reviews VALUES ('r','order',?,'seller',5,'Review','2026-01-01')"
        with self.assertRaises(sqlite3.IntegrityError): self.db.execute(statement,('buyer',))
        self.db.execute("UPDATE orders SET status='COMPLETED'")
        with self.assertRaises(sqlite3.IntegrityError): self.db.execute(statement,('stranger',))
        self.db.execute(statement,('buyer',))
        with self.assertRaises(sqlite3.IntegrityError): self.db.execute(statement.replace("'r'","'r2'"),('buyer',))
    def test_private_verification_media(self):
        statement="INSERT INTO media_assets(id,uploader_id,storage_key,mime_type,visibility,verification_id) VALUES ('m','buyer','private/key','image/png',?,'v-buyer')"
        with self.assertRaises(sqlite3.IntegrityError): self.db.execute(statement,('PUBLIC',))
        self.db.execute(statement,('PRIVATE',))
    def test_social_kinds_friend_request_and_scan_status(self):
        statement="INSERT INTO content_entries(id,author_id,kind,title,body,status,points_cost,metadata_json) VALUES (?,'buyer',?,'Title','Body',?,0,'{}')"
        self.db.execute(statement,('post','POST','PUBLISHED'))
        self.db.execute(statement,('tip','TIP','HIDDEN'))
        self.db.execute(statement,('scan','SCAN','PRIVATE'))
        with self.assertRaises(sqlite3.IntegrityError): self.db.execute("UPDATE content_entries SET status='PUBLISHED' WHERE id='scan'")
        self.db.execute("UPDATE content_entries SET status='ARCHIVED' WHERE id='scan'")
        with self.assertRaises(sqlite3.IntegrityError): self.db.execute("UPDATE content_entries SET status='PRIVATE' WHERE id='post'")
        interaction="INSERT INTO interactions(id,user_id,type,target_user_id,created_at) VALUES (?,'buyer',?,'seller','2026-01-01')"
        self.db.execute(interaction,('friend','FRIEND_REQUEST'))
        with self.assertRaises(sqlite3.IntegrityError): self.db.execute(interaction,('share','SHARE'))
    def test_scan_media_cannot_be_public_on_insert_or_update(self):
        self.db.execute("INSERT INTO content_entries(id,author_id,kind,title,body,status,points_cost,metadata_json) VALUES ('scan','buyer','SCAN','Photo','','PRIVATE',0,'{}')")
        statement="INSERT INTO media_assets(id,uploader_id,storage_key,mime_type,visibility,content_id) VALUES ('scan-image','buyer','private/scan','image/jpeg',?,'scan')"
        with self.assertRaises(sqlite3.IntegrityError): self.db.execute(statement,('PUBLIC',))
        self.db.execute(statement,('PRIVATE',))
        with self.assertRaises(sqlite3.IntegrityError): self.db.execute("UPDATE media_assets SET visibility='PUBLIC' WHERE id='scan-image'")
    def test_audit_is_append_only(self):
        self.db.execute("INSERT INTO audit_logs VALUES ('a','admin','TEST','order','1','Test','2026-01-01')")
        with self.assertRaises(sqlite3.IntegrityError): self.db.execute("DELETE FROM audit_logs")
        with self.assertRaises(sqlite3.IntegrityError): self.db.execute("UPDATE audit_logs SET reason='Changed'")
    def test_all_xml_and_diagrams_valid(self):
        for path in (ROOT/'app/src/main/res').rglob('*.xml'): ET.parse(path)
        out=ROOT/'Recycling Share App/diagrams-v2'
        for name in ['class-diagram','erd','function-diagram']:
            ET.parse(out/(name+'.drawio'));ET.parse(out/(name+'.svg'))
        for name in ['class-diagram','erd']:
            nodes=[c for c in ET.parse(out/(name+'.drawio')).iter('mxCell') if c.get('vertex')=='1']
            self.assertEqual(len(nodes),20)
        with zipfile.ZipFile(out/'ecoshare-diagrams-v2.zip') as archive:self.assertIsNone(archive.testzip())
    def test_current_diagrams_match_audited_domain(self):
        model=json.loads((ROOT/'docs/domain-model.json').read_text(encoding='utf-8'))
        app_names={
            'User','Verification','Address','Category','Listing','ListingItem',
            'MediaAsset','Interaction','Order','OrderItem','Payment','Conversation','Message',
            'Report','GreenLedger','ContentEntry','AuditLog','SystemSetting',
        }
        app_model=[entity for entity in model if entity['name'] in app_names]
        self.assertEqual(len(app_model),18)
        out=ROOT/'Recycling Share App/diagrams-current'
        for name in ['class-diagram','runtime-class-diagram','erd','function-diagram']:
            ET.parse(out/(name+'.drawio'));ET.parse(out/(name+'.svg'))
            self.assertTrue((out/(name+'.mmd')).read_text(encoding='utf-8').strip())
        for name in ['class-diagram','erd']:
            nodes={cell.get('id') for cell in ET.parse(out/(name+'.drawio')).iter('mxCell') if cell.get('vertex')=='1'}
            self.assertEqual(nodes,app_names)
            text=(out/(name+'.mmd')).read_text(encoding='utf-8')
            for entity in app_model:
                prefix='    '+('class ' if name=='class-diagram' else '')+entity['name']+' {\n'
                self.assertIn(prefix,text)
                block=text.split(prefix,1)[1].split('    }',1)[0]
                for field in entity['fields']:
                    field_name=field['name'] if name=='erd' else self._camel(field['name'])
                    self.assertRegex(block,r'\b'+re.escape(field_name)+r'\b')
                    if field['target']:
                        relation=entity['name']+' : '+field_name
                        if field['target'] in app_names:
                            self.assertIn(relation,text)
        function=(out/'function-diagram.mmd').read_text(encoding='utf-8').casefold()
        for absent_feature in ['collectionpoint','điểm thu gom','đổi thưởng','nhóm/sự kiện',
                               'đánh giá/tranh chấp','otp','backend-only','chưa nối app','màn mẫu']:
            self.assertNotIn(absent_feature,function)
        self.assertIn('demo',function)
        self.assertIn('momo',function)
        self.assertIn('vnpay',function)
        self.assertIn('Payment', {entity['name'] for entity in app_model})
        with zipfile.ZipFile(out/'ecoshare-diagrams-current.zip') as archive:
            self.assertIsNone(archive.testzip())
            for name in ['class-diagram','runtime-class-diagram','erd','function-diagram']:
                self.assertIn(name+'.svg',archive.namelist())
    @staticmethod
    def _camel(name):
        import re
        return re.sub(r'_([a-z])',lambda match:match[1].upper(),name)
    def test_every_mobile_route_has_a_layout(self):
        android='{http://schemas.android.com/apk/res/android}'
        layouts=ROOT/'app/src/main/res/layout'
        catalogue=json.loads((ROOT/'docs/android-screens.json').read_text(encoding='utf-8'))
        self.assertEqual(len(catalogue),53)
        for layout in layouts.glob('*.xml'):
            for node in ET.parse(layout).iter():
                tag=node.get(android+'tag','')
                if tag.startswith('screen:'):self.assertTrue((layouts/('fragment_'+tag[7:]+'.xml')).exists(),tag)

if __name__=='__main__':unittest.main(verbosity=2)
