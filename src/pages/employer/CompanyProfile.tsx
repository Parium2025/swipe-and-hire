import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { useState } from 'react';
import { toast } from '@/hooks/use-toast';

const CompanyProfile = () => {
  const { profile, updateProfile } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    company_name: profile?.company_name || '',
    industry: profile?.industry || '',
    address: profile?.address || '',
    website: profile?.website || '',
    company_description: profile?.company_description || '',
    employee_count: profile?.employee_count || '',
  });

  const handleSave = async () => {
    try {
      await updateProfile(formData);
      setIsEditing(false);
      toast({
        title: "Företagsprofil uppdaterad",
        description: "Din företagsprofil har uppdaterats framgångsrikt."
      });
    } catch (error) {
      toast({
        title: "Fel",
        description: "Kunde inte uppdatera företagsprofilen.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Företagsprofil</h1>
        <p className="text-white/70">Hantera din företagsinformation</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Företagsinformation</CardTitle>
          <CardDescription>
            Uppdatera din företagsprofil för att synas bättre för kandidater
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="company_name">Företagsnamn</Label>
            <Input
              id="company_name"
              value={formData.company_name}
              onChange={(e) => setFormData({...formData, company_name: e.target.value})}
              disabled={!isEditing}
            />
          </div>

          <div>
            <Label htmlFor="industry">Bransch</Label>
            <Input
              id="industry"
              value={formData.industry}
              onChange={(e) => setFormData({...formData, industry: e.target.value})}
              disabled={!isEditing}
            />
          </div>

          <div>
            <Label htmlFor="address">Adress</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({...formData, address: e.target.value})}
              disabled={!isEditing}
            />
          </div>

          <div>
            <Label htmlFor="website">Webbsida</Label>
            <Input
              id="website" 
              value={formData.website}
              onChange={(e) => setFormData({...formData, website: e.target.value})}
              disabled={!isEditing}
              placeholder="https://exempel.se"
            />
          </div>

          <div>
            <Label htmlFor="employee_count">Antal anställda</Label>
            <Select 
              value={formData.employee_count} 
              onValueChange={(value) => setFormData({...formData, employee_count: value})}
              disabled={!isEditing}
            >
              <SelectTrigger>
                <SelectValue placeholder="Välj antal anställda" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1-10 anställda">1-10 anställda</SelectItem>
                <SelectItem value="11-50 anställda">11-50 anställda</SelectItem>
                <SelectItem value="51-200 anställda">51-200 anställda</SelectItem>
                <SelectItem value="201-1000 anställda">201-1000 anställda</SelectItem>
                <SelectItem value="1000+ anställda">1000+ anställda</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="company_description">Företagsbeskrivning</Label>
            <Textarea
              id="company_description"
              value={formData.company_description}
              onChange={(e) => setFormData({...formData, company_description: e.target.value})}
              disabled={!isEditing}
              rows={4}
              placeholder="Beskriv ditt företag, kultur och värderingar..."
            />
          </div>

          <div className="flex gap-2">
            {isEditing ? (
              <>
                <Button onClick={handleSave}>Spara</Button>
                <Button variant="outline" onClick={() => setIsEditing(false)}>
                  Avbryt
                </Button>
              </>
            ) : (
              <Button onClick={() => setIsEditing(true)}>Redigera</Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CompanyProfile;